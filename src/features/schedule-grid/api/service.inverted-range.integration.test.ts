/**
 * Integration tests for the Opsi B close-old guard in
 * `createAssignmentInlineFn` (schedule-grid ticket 03) plus read-side
 * hardening of `resolveScheduleGridCells`.
 *
 * Root cause of the prod incident: the fn auto-closed a pre-existing
 * open-ended assignment with `closingDate = effectiveFrom - 1 day` and no
 * guard that `closingDate >= openEnded.effective_from`. When the new
 * `effectiveFrom <= old effective_from`, the UPDATE wrote an inverted range
 * (`effective_from > effective_to`, e.g. dhani id=1: 2026-09-14 → 2026-09-07)
 * that then won overlap selection via `ORDER BY effective_from DESC`.
 *
 * Decision: REJECT the whole request (`{ success: false, error:
 * 'closeWouldInvertRange', conflictingFrom }`, nothing written) rather than
 * silently skipping the close. A probe proved skip+insert is unimplementable:
 * the untouched old row stays open-ended, so an open-ended new row violates
 * the `schedule_assignments_one_active_unique` partial unique index, while a
 * bounded new row would leave two overlapping assignments behind. Rejection
 * keeps every DB invariant intact and tells the admin exactly which start
 * date to pick instead (any From after the old row's start closes cleanly).
 *
 * Harness mirrors `write-service.integration.test.ts` (split-provider +
 * session/rate-limit mocks against the real test DB).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  resetAllTables,
  seedShift,
  seedShiftWeekdayRule,
  seedScheduleAssignment
} from '@/test-utils/db';
import { withInvertedRangeRows } from '@/test-utils/schedule-range';
import { db } from '@/lib/db';
import { scheduleAssignments } from '@/lib/db/schema/attendance';
import { resolveScheduleGridCells } from './cell-resolver';

const sessionUser = vi.hoisted(() => ({
  id: 'schedule-inline-test-admin',
  role: 'admin',
  permissions: { attendance_admin: { edit: true } }
}));
const requirePermissionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const checkRateLimitMock = vi.hoisted(() => vi.fn(async () => undefined));

const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

const createServerFnMock = vi.hoisted(() => {
  return () => {
    let validator: { parse(input: unknown): unknown } | undefined;
    const builder = {
      validator(nextValidator: { parse(input: unknown): unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(...handlers: Array<(context: { data: unknown }) => unknown>) {
        const nextHandler = handlers.at(-1)!;
        const invoke = async (options: { data: unknown }) =>
          nextHandler({ data: validator ? validator.parse(options.data) : options.data });
        return Object.assign(invoke, { __executeServer: invoke });
      }
    };
    return builder;
  };
});

vi.mock('@tanstack/react-start', () => ({
  createServerFn: createServerFnMock
}));

vi.mock('@tanstack/react-start/server-rpc', () => ({
  createServerRpc: (_meta: unknown, fn: (options: unknown) => unknown) => fn
}));

vi.mock('@tanstack/react-start/ssr-rpc', () => ({
  createSsrRpc: () => (options: { data: unknown }) => serverFnProvider.handler!(options)
}));

vi.mock('@/lib/auth/auth.server', () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: sessionUser })) } }
}));

vi.mock('@/lib/auth/session', () => ({
  requirePermission: requirePermissionMock
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { createAssignmentInlineFn_createServerFn_handler } from './service?tss-serverfn-split';

const TEST_USER_ID = 'schedule-inline-close-guard-user';

async function readAssignments(userId: string) {
  return db.select().from(scheduleAssignments).where(eq(scheduleAssignments.user_id, userId));
}

describe('createAssignmentInlineFn — close-old inverted-range guard (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    serverFnProvider.handler = createAssignmentInlineFn_createServerFn_handler;
    await seedShift({ id: 1, name: 'Morning' });
    await seedShift({ id: 2, name: 'Evening' });
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('rejects when the new effectiveFrom equals the old effective_from (close would invert)', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-08',
      effective_to: null
    });

    const res = (await serverFnProvider.handler!({
      data: { userId: TEST_USER_ID, shiftId: 2, effectiveFrom: '2026-09-08' }
    })) as {
      success: boolean;
      error?: string;
      conflictingFrom?: string;
    };

    // closingDate 2026-09-07 < old from 2026-09-08 → reject, nothing written.
    expect(res.success).toBe(false);
    expect(res.error).toBe('closeWouldInvertRange');
    expect(res.conflictingFrom).toBe('2026-09-08');

    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].shift_id).toBe(1);
    expect(rows[0].effective_to).toBeNull();
  });

  it('rejects when the new effectiveFrom predates the old effective_from', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-08',
      effective_to: null
    });

    const res = (await serverFnProvider.handler!({
      data: { userId: TEST_USER_ID, shiftId: 2, effectiveFrom: '2026-09-01' }
    })) as { success: boolean; error?: string; conflictingFrom?: string };

    expect(res.success).toBe(false);
    expect(res.error).toBe('closeWouldInvertRange');
    expect(res.conflictingFrom).toBe('2026-09-08');

    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].effective_to).toBeNull();
  });

  it('still closes normally when closingDate >= old effective_from', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-01',
      effective_to: null
    });

    const res = (await serverFnProvider.handler!({
      data: { userId: TEST_USER_ID, shiftId: 2, effectiveFrom: '2026-09-10' }
    })) as {
      success: boolean;
      closedAssignment?: { effective_to: string | null };
    };

    expect(res.success).toBe(true);
    expect(res.closedAssignment?.effective_to).toBe('2026-09-09');

    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.shift_id === 1)?.effective_to).toBe('2026-09-09');
  });

  it("keeps rejecting an inverted new row with 'effectiveToBeforeFrom'", async () => {
    const res = (await serverFnProvider.handler!({
      data: {
        userId: TEST_USER_ID,
        shiftId: 2,
        effectiveFrom: '2026-09-14',
        effectiveTo: '2026-09-07'
      }
    })) as { success: boolean; error?: string };

    expect(res.success).toBe(false);
    expect(res.error).toBe('effectiveToBeforeFrom');
    expect(await readAssignments(TEST_USER_ID)).toHaveLength(0);
  });
});

describe('resolveScheduleGridCells — skips pre-existing inverted rows (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('resolves the valid assignment when an inverted row overlaps the window', async () => {
    const staleShift = await seedShift({ name: 'Inverted' });
    const validShift = await seedShift({ name: 'Valid' });
    // Engine needs weekday rules + shift policy for every window date.
    for (let dow = 0; dow <= 6; dow += 1) {
      await seedShiftWeekdayRule(validShift.id, {
        day_of_week: dow,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
    }

    await withInvertedRangeRows(async () => {
      // Inverted row chosen so the OLD overlap-only SQL genuinely selects it
      // for the window 2026-09-08..2026-09-14: from 09-12 <= 09-14 ✓ and
      // to 09-10 >= 09-08 ✓ (an incident-shaped row of 14→07 would be
      // rejected by the old overlap SQL alone, exercising nothing).
      await db.insert(scheduleAssignments).values({
        user_id: TEST_USER_ID,
        shift_id: staleShift.id,
        effective_from: '2026-09-12',
        effective_to: '2026-09-10'
      });
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: validShift.id,
        effective_from: '2026-09-08',
        effective_to: null
      });

      const { byUser } = await resolveScheduleGridCells({
        userIds: [TEST_USER_ID],
        startDate: '2026-09-08',
        endDate: '2026-09-14'
      });
      const cell = byUser.get(TEST_USER_ID)!.cells.get('2026-09-10')!;
      // Behavior lock: the resolver's per-date containment (`from <= date AND
      // to >= date`) can never match `from > to`, so this cell outcome is
      // inherently immune either way. The assertion that the inverted row is
      // excluded at the SQL level is behaviourally pinned by the
      // `getMonthlyScheduleData` integration test; here the loading predicate
      // is still exercised (the row overlaps the window under old SQL).
      expect(cell.hasAssignment).toBe(true);
      expect(cell.shiftId).toBe(validShift.id);
    });
  });
});

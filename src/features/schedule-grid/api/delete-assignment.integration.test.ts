/**
 * Integration tests for `deleteAssignmentFn` — the destructive write behind
 * the grid popover's "Delete schedule" button.
 *
 * The fn exists because nothing in the admin UI could remove a
 * `schedule_assignments` row: `clearCellFn` only deletes `date_overrides` /
 * `day_offs`, so the only way to undo a range was to overwrite it with
 * another range. These tests pin the contract the UI depends on:
 *
 *   - the whole addressed range goes, and only that range;
 *   - the delete is scoped by `user_id`, so a stale/tampered `assignmentId`
 *     cannot remove another employee's assignment;
 *   - a missing row is reported as `notFound` (not `internal`) so the client
 *     re-syncs instead of claiming the write failed;
 *   - per-date overrides / day offs are deliberately preserved (they are
 *     independent of the assignment);
 *   - the returned `cell` is the read path's own re-resolution, so the
 *     popover's cache refresh matches a fresh fetch.
 *
 * Harness mirrors `service.inverted-range.integration.test.ts` (split-provider
 * + session/rate-limit mocks against the real test DB).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  resetAllTables,
  seedDateOverride,
  seedDayOff,
  seedScheduleAssignment,
  seedShift,
  seedShiftWeekdayRule
} from '@/test-utils/db';
import { db } from '@/lib/db';
import { dateOverrides, dayOffs, scheduleAssignments } from '@/lib/db/schema/attendance';
import { resolveScheduleGridCell } from './cell-resolver';

const sessionUser = vi.hoisted(() => ({
  id: 'schedule-delete-test-admin',
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
import { deleteAssignmentFn_createServerFn_handler } from './service?tss-serverfn-split';

const TEST_USER_ID = 'schedule-delete-test-user';
const OTHER_USER_ID = 'schedule-delete-other-user';

type DeleteResult = {
  success: boolean;
  error?: string;
  deletedId?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  cell?: {
    hasAssignment: boolean;
    assignmentId: number | null;
    shiftId: number | null;
  };
};

async function invokeDelete(data: {
  userId: string;
  date: string;
  assignmentId: number;
}): Promise<DeleteResult> {
  return (await serverFnProvider.handler!({ data })) as DeleteResult;
}

async function readAssignments(userId: string) {
  return db.select().from(scheduleAssignments).where(eq(scheduleAssignments.user_id, userId));
}

describe('deleteAssignmentFn (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    serverFnProvider.handler = deleteAssignmentFn_createServerFn_handler;
    await seedShift({ id: 1, name: 'Morning' });
    // 2026-09-17 is a Thursday (day_of_week 4).
    await seedShiftWeekdayRule(1, { day_of_week: 4, is_working_day: true });
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('deletes the covering range and re-resolves the cell to unassigned', async () => {
    const assignment = await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-14',
      effective_to: '2026-09-18'
    });

    // The resolved cell is what the popover sends back: without it the write
    // has no exact target. Pin it so a resolver regression that stops
    // populating the assignment identity fails here, not in the browser.
    const before = await resolveScheduleGridCell(TEST_USER_ID, '2026-09-17');
    expect(before.assignmentId).toBe(assignment.id);
    expect(before.assignmentFrom).toBe('2026-09-14');
    expect(before.assignmentTo).toBe('2026-09-18');
    expect(before.hasAssignment).toBe(true);
    expect(before.hasOverride).toBe(false);

    const res = await invokeDelete({
      userId: TEST_USER_ID,
      date: '2026-09-17',
      assignmentId: assignment.id
    });

    expect(res.success).toBe(true);
    expect(res.deletedId).toBe(assignment.id);
    expect(res.effectiveFrom).toBe('2026-09-14');
    expect(res.effectiveTo).toBe('2026-09-18');
    expect(res.cell?.hasAssignment).toBe(false);
    expect(res.cell?.assignmentId).toBeNull();
    expect(res.cell?.shiftId).toBeNull();

    expect(await readAssignments(TEST_USER_ID)).toHaveLength(0);
  });

  it('removes only the addressed range, leaving sibling ranges in the month', async () => {
    const early = await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-01',
      effective_to: '2026-09-05'
    });
    const later = await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-14',
      effective_to: '2026-09-18'
    });

    const res = await invokeDelete({
      userId: TEST_USER_ID,
      date: '2026-09-17',
      assignmentId: later.id
    });

    expect(res.success).toBe(true);
    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(early.id);
    expect(rows[0]!.effective_to).toBe('2026-09-05');
  });

  it('refuses to delete an assignment owned by another user', async () => {
    const assignment = await seedScheduleAssignment({
      user_id: OTHER_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-14',
      effective_to: '2026-09-18'
    });

    const res = await invokeDelete({
      userId: TEST_USER_ID,
      date: '2026-09-17',
      assignmentId: assignment.id
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('notFound');
    expect(await readAssignments(OTHER_USER_ID)).toHaveLength(1);
  });

  it('reports notFound when the range is already gone', async () => {
    const res = await invokeDelete({
      userId: TEST_USER_ID,
      date: '2026-09-17',
      assignmentId: 999_999
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('notFound');
  });

  it('keeps date overrides and day offs on the deleted range', async () => {
    const assignment = await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-14',
      effective_to: '2026-09-18'
    });
    await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-09-15', shift_id: 1 });
    await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-16' });

    const res = await invokeDelete({
      userId: TEST_USER_ID,
      date: '2026-09-17',
      assignmentId: assignment.id
    });

    expect(res.success).toBe(true);
    expect(await readAssignments(TEST_USER_ID)).toHaveLength(0);
    expect(
      await db.select().from(dateOverrides).where(eq(dateOverrides.user_id, TEST_USER_ID))
    ).toHaveLength(1);
    expect(await db.select().from(dayOffs).where(eq(dayOffs.user_id, TEST_USER_ID))).toHaveLength(
      1
    );
  });
});

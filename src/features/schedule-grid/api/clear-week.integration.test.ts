/**
 * Integration tests for `clearWeekFn` — the destructive write behind the
 * schedule-grid row header's "Clear week" action.
 *
 * The fn removes EVERYTHING an employee has inside one 7-day window: their
 * `date_overrides`, their `day_offs`, and their `schedule_assignments`
 * coverage. Assignments that merely overlap the week's edges are trimmed or
 * split, never deleted wholesale (the days outside the week must survive).
 *
 * The load-bearing assertion for a destructive op is the negative one: the
 * employee's rows OUTSIDE the window — before it and after it — must be
 * byte-identical after the clear. These tests pin that plus the trim/split
 * boundaries, the `created_by` preservation on split inserts, other-employee
 * isolation, and the zero-work happy path.
 *
 * Harness mirrors `delete-assignment.integration.test.ts` (split-provider +
 * session/rate-limit mocks against the real test DB).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';
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

const sessionUser = vi.hoisted(() => ({
  id: 'schedule-clear-week-test-admin',
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
import { clearWeekFn_createServerFn_handler } from './service?tss-serverfn-split';

const TEST_USER_ID = 'schedule-clear-week-test-user';
const OTHER_USER_ID = 'schedule-clear-week-other-user';
const WEEK_START = '2026-09-07';
const WEEK_END = '2026-09-13';

type ClearWeekResult = {
  success: boolean;
  error?: string;
  deletedAssignments?: number;
  trimmedAssignments?: number;
  splitAssignments?: number;
  clearedOverrides?: number;
  clearedDayOffs?: number;
  totalCleared?: number;
};

async function invokeClear(data: { userId: string; weekStart: string }): Promise<ClearWeekResult> {
  return (await serverFnProvider.handler!({ data })) as ClearWeekResult;
}

async function readAssignments(userId: string) {
  return db
    .select()
    .from(scheduleAssignments)
    .where(eq(scheduleAssignments.user_id, userId))
    .orderBy(asc(scheduleAssignments.effective_from), asc(scheduleAssignments.id));
}

async function readAssignmentsIn(userId: string, from: string, to: string) {
  const rows = await db
    .select()
    .from(scheduleAssignments)
    .where(eq(scheduleAssignments.user_id, userId))
    .orderBy(asc(scheduleAssignments.effective_from), asc(scheduleAssignments.id));
  return rows.filter((r) => r.effective_from <= to && r.effective_to >= from);
}

async function readOverrides(userId: string) {
  return db.select().from(dateOverrides).where(eq(dateOverrides.user_id, userId));
}

async function readDayOffs(userId: string) {
  return db.select().from(dayOffs).where(eq(dayOffs.user_id, userId));
}

describe('clearWeekFn (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    serverFnProvider.handler = clearWeekFn_createServerFn_handler;
    await seedShift({ id: 1, name: 'Morning' });
    await seedShiftWeekdayRule(1, { day_of_week: 1, is_working_day: true });
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('removes date overrides and day offs inside the week, leaving ones outside untouched', async () => {
    await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-09-08', shift_id: 1 });
    await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-09', reason: 'Sakit' });
    await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-09-14', shift_id: 1 });
    await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-06', reason: 'Cuti' });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.clearedOverrides).toBe(1);
    expect(res.clearedDayOffs).toBe(1);
    expect(res.totalCleared).toBe(2);

    const overrides = await readOverrides(TEST_USER_ID);
    expect(overrides.map((o) => o.date)).toEqual(['2026-09-14']);
    const offs = await readDayOffs(TEST_USER_ID);
    expect(offs.map((d) => d.date)).toEqual(['2026-09-06']);
  });

  it('deletes an assignment fully inside the week', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-08',
      effective_to: '2026-09-11'
    });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.deletedAssignments).toBe(1);
    expect(await readAssignments(TEST_USER_ID)).toHaveLength(0);
  });

  it('splits an assignment spanning the whole week, preserving shift and created_by', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-01',
      effective_to: '2026-09-30',
      created_by: 'original-creator'
    });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.splitAssignments).toBe(1);
    expect(res.totalCleared).toBe(1);

    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.effective_from).toBe('2026-09-01');
    expect(rows[0]!.effective_to).toBe('2026-09-06');
    expect(rows[1]!.effective_from).toBe('2026-09-14');
    expect(rows[1]!.effective_to).toBe('2026-09-30');
    for (const row of rows) {
      expect(row.shift_id).toBe(1);
      expect(row.created_by).toBe('original-creator');
    }
  });

  it('trims the start of an assignment that begins inside the week and runs past it', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-09',
      effective_to: '2026-09-30',
      created_by: 'original-creator'
    });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.trimmedAssignments).toBe(1);
    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.effective_from).toBe('2026-09-14');
    expect(rows[0]!.effective_to).toBe('2026-09-30');
    expect(rows[0]!.created_by).toBe('original-creator');
  });

  it('trims the end of an assignment that starts before the week and ends inside it', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-01',
      effective_to: '2026-09-09'
    });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.trimmedAssignments).toBe(1);
    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.effective_from).toBe('2026-09-01');
    expect(rows[0]!.effective_to).toBe('2026-09-06');
  });

  it('leaves assignments entirely outside the week byte-identical', async () => {
    const before = await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-08-01',
      effective_to: '2026-08-31',
      created_by: 'before-creator'
    });
    const after = await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-14',
      effective_to: '2026-09-30',
      created_by: 'after-creator'
    });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.totalCleared).toBe(0);
    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === before.id)).toMatchObject({
      effective_from: '2026-08-01',
      effective_to: '2026-08-31',
      created_by: 'before-creator'
    });
    expect(rows.find((r) => r.id === after.id)).toMatchObject({
      effective_from: '2026-09-14',
      effective_to: '2026-09-30',
      created_by: 'after-creator'
    });
  });

  it("never touches another employee's rows", async () => {
    await seedScheduleAssignment({
      user_id: OTHER_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-01',
      effective_to: '2026-09-30'
    });
    await seedDateOverride({ user_id: OTHER_USER_ID, date: '2026-09-09', shift_id: 1 });
    await seedDayOff({ user_id: OTHER_USER_ID, date: '2026-09-10', reason: 'Cuti' });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.totalCleared).toBe(0);
    expect(await readAssignmentsIn(OTHER_USER_ID, WEEK_START, WEEK_END)).toHaveLength(1);
    expect(await readOverrides(OTHER_USER_ID)).toHaveLength(1);
    expect(await readDayOffs(OTHER_USER_ID)).toHaveLength(1);
  });

  it('reports success with zero counts when there is nothing to clear', async () => {
    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.deletedAssignments).toBe(0);
    expect(res.trimmedAssignments).toBe(0);
    expect(res.splitAssignments).toBe(0);
    expect(res.clearedOverrides).toBe(0);
    expect(res.clearedDayOffs).toBe(0);
    expect(res.totalCleared).toBe(0);
  });

  it('clears overrides, day offs and assignment coverage together', async () => {
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-09-01',
      effective_to: '2026-09-30'
    });
    await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-09-08', shift_id: 1 });
    await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-09', reason: 'Sakit' });

    const res = await invokeClear({ userId: TEST_USER_ID, weekStart: WEEK_START });

    expect(res.success).toBe(true);
    expect(res.totalCleared).toBe(3);
    expect(await readOverrides(TEST_USER_ID)).toHaveLength(0);
    expect(await readDayOffs(TEST_USER_ID)).toHaveLength(0);
    const rows = await readAssignments(TEST_USER_ID);
    expect(rows).toHaveLength(2);
    // No surviving coverage inside the window.
    expect(await readAssignmentsIn(TEST_USER_ID, WEEK_START, WEEK_END)).toHaveLength(0);
  });
});

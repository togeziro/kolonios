/**
 * Integration tests for `write-service.ts` (schedule-grid ticket-02 server fns).
 *
 * Drives the production server-fn handlers via the `?tss-serverfn-split`
 * TanStack Start provider, with `@/lib/auth/session` and `@/lib/rate-limit`
 * mocked so each handler runs against the actual test DB without needing
 * a real session. Pattern mirrors
 * `src/features/payroll/api/service.integration.test.ts` and
 * `src/features/tickets/api/service.test.ts`.
 *
 * Coverage for the orphan-prevention guard in `setCellShiftFn` /
 * `applyToWholeWeekFn`: when the cell already has a `day_offs` row and an
 * admin writes a shift, the day_off is auto-deleted so the new override
 * takes precedence immediately (instead of being masked by the day_off and
 * "appearing" later when the day_off is cleared). See
 * `.scratch/shift-scheduler/EPIC_SUMMARY.md` § Follow-ups #2.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  resetAllTables,
  seedScheduleAssignment,
  seedShift,
  seedDayOff,
  seedDateOverride,
  seedEmployee
} from '@/test-utils/db';
import { db } from '@/lib/db';
import { dateOverrides, dayOffs } from '@/lib/db/schema/attendance';
import { addDays } from '../utils/date-utils';

const sessionUser = vi.hoisted(() => ({
  id: 'schedule-grid-test-admin',
  role: 'admin',
  permissions: { attendance_admin: { edit: true } }
}));
const getSessionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
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
  auth: { api: { getSession: getSessionMock } }
}));

vi.mock('@/lib/auth/session', () => ({
  requirePermission: requirePermissionMock
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { setCellShiftFn_createServerFn_handler } from './write-service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { applyToWholeWeekFn_createServerFn_handler } from './write-service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { repeatWeekBulkFn_createServerFn_handler } from './bulk-service?tss-serverfn-split';

const TEST_USER_ID = 'schedule-grid-test-user-orphan';

async function readDayOff(userId: string, date: string) {
  const rows = await db.select().from(dayOffs).where(eq(dayOffs.user_id, userId)).limit(50);
  return rows.find((r) => r.date === date) ?? null;
}

async function readDateOverride(userId: string, date: string) {
  const rows = await db
    .select()
    .from(dateOverrides)
    .where(eq(dateOverrides.user_id, userId))
    .limit(50);
  return rows.find((r) => r.date === date) ?? null;
}

describe('schedule-grid write service (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    // Stable fixtures for every test in this file.
    await seedShift({ id: 1, name: 'Morning' });
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: 1,
      effective_from: '2026-01-01'
    });
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('setCellShiftFn — orphan-prevention guard', () => {
    beforeEach(() => {
      serverFnProvider.handler = setCellShiftFn_createServerFn_handler;
    });

    it('creates a date_override when no day_off exists (baseline)', async () => {
      const res = (await serverFnProvider.handler!({
        data: { userId: TEST_USER_ID, date: '2026-08-05', shiftId: 1 }
      })) as { success: boolean; error?: string };

      expect(res.success).toBe(true);
      expect(await readDayOff(TEST_USER_ID, '2026-08-05')).toBeNull();
      expect(await readDateOverride(TEST_USER_ID, '2026-08-05')).not.toBeNull();
    });

    it('auto-deletes an existing day_off for the same (user, date)', async () => {
      await seedDayOff({
        user_id: TEST_USER_ID,
        date: '2026-08-05',
        reason: 'Cuti'
      });

      const res = (await serverFnProvider.handler!({
        data: { userId: TEST_USER_ID, date: '2026-08-05', shiftId: 1 }
      })) as { success: boolean; error?: string };

      expect(res.success).toBe(true);
      // The day_off is auto-cleaned — no masked orphan.
      expect(await readDayOff(TEST_USER_ID, '2026-08-05')).toBeNull();
      expect(await readDateOverride(TEST_USER_ID, '2026-08-05')).not.toBeNull();
    });

    it('does NOT touch day_offs on a different date (no collateral)', async () => {
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-08-06', reason: 'Cuti A' });

      const res = (await serverFnProvider.handler!({
        data: { userId: TEST_USER_ID, date: '2026-08-05', shiftId: 1 }
      })) as { success: boolean; error?: string };

      expect(res.success).toBe(true);
      expect(await readDayOff(TEST_USER_ID, '2026-08-06')).not.toBeNull();
      expect(await readDateOverride(TEST_USER_ID, '2026-08-05')).not.toBeNull();
    });

    it('replaces an existing date_override with the new shiftId (idempotent re-save)', async () => {
      const res1 = (await serverFnProvider.handler!({
        data: { userId: TEST_USER_ID, date: '2026-08-05', shiftId: 1 }
      })) as { success: boolean; error?: string };
      expect(res1.success).toBe(true);

      const res2 = (await serverFnProvider.handler!({
        data: { userId: TEST_USER_ID, date: '2026-08-05', shiftId: 1 }
      })) as { success: boolean; error?: string };
      expect(res2.success).toBe(true);

      const allOverrides = await db
        .select()
        .from(dateOverrides)
        .where(eq(dateOverrides.user_id, TEST_USER_ID));
      const onDate = allOverrides.filter((o) => o.date === '2026-08-05');
      expect(onDate).toHaveLength(1);
    });
  });

  describe('applyToWholeWeekFn — orphan-prevention guard on shift mode', () => {
    beforeEach(() => {
      serverFnProvider.handler = applyToWholeWeekFn_createServerFn_handler;
    });

    it('skips weekend days when includeWeekend=false and clears day_offs on working days', async () => {
      // 2026-08-03 (Mon) — 2026-08-09 (Sun). Weekend = Sat (8) + Sun (9).
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-08-04', reason: 'Tue cuti' });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-08-08', reason: 'Sat cuti' });

      const res = (await serverFnProvider.handler!({
        data: {
          userId: TEST_USER_ID,
          weekStart: '2026-08-03',
          mode: 'shift',
          shiftId: 1,
          includeWeekend: false
        }
      })) as {
        success: boolean;
        daysApplied: number;
        partialFailures: Array<{ date: string; error: string }>;
      };

      expect(res.success).toBe(true);
      // 5 working days (Mon..Fri); the Sat day_off was skipped, not applied to.
      expect(res.daysApplied).toBe(5);
      // Tue day_off was auto-cleaned by the orphan guard.
      expect(await readDayOff(TEST_USER_ID, '2026-08-04')).toBeNull();
      // Sat day_off was not touched (skipped from iteration).
      expect(await readDayOff(TEST_USER_ID, '2026-08-08')).not.toBeNull();
    });
  });

  describe('repeatWeekBulkFn — bulk cross-week duplicate (ticket 03)', () => {
    beforeEach(() => {
      serverFnProvider.handler = repeatWeekBulkFn_createServerFn_handler;
    });

    it('replicates source overrides + day offs onto the target week (DELETE-then-INSERT orphan guard)', async () => {
      // Source week 2026-08-31 (Mon) .. 2026-09-06 (Sun).
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-08-31', shift_id: 1 });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-01', reason: 'Cuti' });
      // Conflicting target rows that the copy must replace, not duplicate.
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-07', reason: 'Old' });
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-09-08', shift_id: 1 });

      const res = (await serverFnProvider.handler!({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-07'],
          userIds: [TEST_USER_ID],
          includeWeekend: false
        }
      })) as {
        success: boolean;
        weeksApplied: number;
        usersAffected: number;
        cellsApplied: number;
        partialFailures: Array<{ userId: string; date: string; error: string }>;
      };

      expect(res.success).toBe(true);
      expect(res.weeksApplied).toBe(1);
      expect(res.usersAffected).toBe(1);
      expect(res.cellsApplied).toBe(2);
      expect(res.partialFailures).toEqual([]);

      // Target Mon: override written, stale day off removed.
      expect(await readDayOff(TEST_USER_ID, '2026-09-07')).toBeNull();
      const targetOverride = await readDateOverride(TEST_USER_ID, '2026-09-07');
      expect(targetOverride).not.toBeNull();
      expect(targetOverride!.shift_id).toBe(1);
      // Target Tue: day off written (reason carried over), stale override removed.
      expect(await readDateOverride(TEST_USER_ID, '2026-09-08')).toBeNull();
      expect((await readDayOff(TEST_USER_ID, '2026-09-08'))?.reason).toBe('Cuti');
      // Source week untouched.
      expect(await readDateOverride(TEST_USER_ID, '2026-08-31')).not.toBeNull();
      expect((await readDayOff(TEST_USER_ID, '2026-09-01'))?.reason).toBe('Cuti');
    });

    it('skips weekend source dates when includeWeekend=false', async () => {
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-09-05', shift_id: 1 }); // Sat
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-06', reason: 'Libur' }); // Sun

      const res = (await serverFnProvider.handler!({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-07'],
          userIds: [TEST_USER_ID],
          includeWeekend: false
        }
      })) as { success: boolean; cellsApplied: number; weeksApplied: number };

      expect(res.success).toBe(true);
      expect(res.cellsApplied).toBe(0);
      expect(res.weeksApplied).toBe(0);
      expect(await readDateOverride(TEST_USER_ID, '2026-09-12')).toBeNull(); // target Sat
      expect(await readDayOff(TEST_USER_ID, '2026-09-13')).toBeNull(); // target Sun
    });

    it('copies weekend source dates when includeWeekend=true', async () => {
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-09-05', shift_id: 1 }); // Sat
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-06', reason: 'Libur' }); // Sun

      const res = (await serverFnProvider.handler!({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-07'],
          userIds: [TEST_USER_ID],
          includeWeekend: true
        }
      })) as { success: boolean; cellsApplied: number };

      expect(res.success).toBe(true);
      expect(res.cellsApplied).toBe(2);
      const satOverride = await readDateOverride(TEST_USER_ID, '2026-09-12');
      expect(satOverride).not.toBeNull();
      expect(satOverride!.shift_id).toBe(1);
      expect((await readDayOff(TEST_USER_ID, '2026-09-13'))?.reason).toBe('Libur');
    });

    it('resolves users from the division + search filter when userIds is omitted', async () => {
      const { employee: empA } = await seedEmployee('bulk-user-a', { full_name: 'Aldi Repeat' });
      await seedEmployee('bulk-user-b', { full_name: 'Bayu Repeat' });
      await seedDateOverride({ user_id: 'bulk-user-a', date: '2026-08-31', shift_id: 1 });
      await seedDayOff({ user_id: 'bulk-user-a', date: '2026-09-01', reason: 'Cuti' });
      await seedDateOverride({ user_id: 'bulk-user-b', date: '2026-08-31', shift_id: 1 });

      // Division filter → only user A.
      const byDivision = (await serverFnProvider.handler!({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-07'],
          divisionId: String(empA.department_id),
          query: null,
          includeWeekend: false
        }
      })) as {
        success: boolean;
        usersAffected: number;
        cellsApplied: number;
      };

      expect(byDivision.success).toBe(true);
      expect(byDivision.usersAffected).toBe(1);
      expect(byDivision.cellsApplied).toBe(2);
      expect(await readDateOverride('bulk-user-a', '2026-09-07')).not.toBeNull();
      expect(await readDateOverride('bulk-user-b', '2026-09-07')).toBeNull();

      // Search filter → only user B.
      const byQuery = (await serverFnProvider.handler!({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-14'],
          divisionId: null,
          query: 'Bayu',
          includeWeekend: false
        }
      })) as { success: boolean; usersAffected: number; cellsApplied: number };

      expect(byQuery.success).toBe(true);
      expect(byQuery.usersAffected).toBe(1);
      expect(byQuery.cellsApplied).toBe(1);
      expect(await readDateOverride('bulk-user-b', '2026-09-14')).not.toBeNull();
    });

    it('captures a failing cell into partialFailures without aborting the batch', async () => {
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-08-31', shift_id: 1 });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-01', reason: 'Cuti' });
      // Fail only the first per-cell transaction (Mon copy); the Tue copy
      // must still land.
      const txSpy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('boom'));

      const res = (await serverFnProvider.handler!({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-07'],
          userIds: [TEST_USER_ID],
          includeWeekend: false
        }
      })) as {
        success: boolean;
        cellsApplied: number;
        partialFailures: Array<{ userId: string; date: string; error: string }>;
      };
      txSpy.mockRestore();

      expect(res.success).toBe(true);
      expect(res.cellsApplied).toBe(1);
      expect(res.partialFailures).toEqual([
        { userId: TEST_USER_ID, date: '2026-09-07', error: 'internal' }
      ]);
      // The surviving cell still applied.
      expect((await readDayOff(TEST_USER_ID, '2026-09-08'))?.reason).toBe('Cuti');
    });

    it('rejects more than 12 target weeks and an empty target list (schema caps)', async () => {
      const thirteen = Array.from({ length: 13 }, (_, i) => addDays('2026-09-07', i * 7));
      await expect(
        serverFnProvider.handler!({
          data: {
            sourceWeekStart: '2026-08-31',
            targetWeekStarts: thirteen,
            userIds: [TEST_USER_ID],
            includeWeekend: false
          }
        })
      ).rejects.toThrow();
      await expect(
        serverFnProvider.handler!({
          data: {
            sourceWeekStart: '2026-08-31',
            targetWeekStarts: [],
            userIds: [TEST_USER_ID],
            includeWeekend: false
          }
        })
      ).rejects.toThrow();
    });

    it('denies callers without attendance_admin:edit (403) before any write', async () => {
      requirePermissionMock.mockRejectedValueOnce(
        new Error('Forbidden: attendance_admin.edit required')
      );
      checkRateLimitMock.mockClear();

      await expect(
        serverFnProvider.handler!({
          data: {
            sourceWeekStart: '2026-08-31',
            targetWeekStarts: ['2026-09-07'],
            userIds: [TEST_USER_ID],
            includeWeekend: false
          }
        })
      ).rejects.toThrow(/Forbidden/);
      expect(checkRateLimitMock).not.toHaveBeenCalled();
    });
  });
});

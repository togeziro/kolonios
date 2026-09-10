/**
 * Integration tests for `cell-resolver.ts` (schedule-grid ticket 02 refactor).
 *
 * Locks in the two properties that motivated extracting
 * `resolveScheduleGridCells` as the single owner of cell resolution:
 *
 *  1. **Parity.** `getScheduleGridFn`'s cell for a given (user, date) is
 *     byte-for-byte identical to the post-write re-resolve the popover
 *     uses (`resolveScheduleGridCell`) for the same (user, date) and DB
 *     state. Before this module the two paths duplicated cell construction
 *     independently and could silently drift; now the re-resolve IS the
 *     read path at N=1.
 *
 *  2. **Recurring-holiday projection.** `getHolidaysInRange`'s SQL clause
 *     matches recurring holidays by MONTH only, so a recurring Aug 21 row
 *     would leak onto any August day that the row shares a month with. The
 *     resolver projects recurring holidays onto the exact day they land on
 *     inside the window — this test locks that projection in for the cell
 *     builder. (Before the extraction the write path's single-cell
 *     re-resolve skipped this projection entirely, so a recurring holiday
 *     could bleed onto the wrong day in the cell the popover receives.)
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  resetAllTables,
  seedShift,
  seedShiftWeekdayRule,
  seedScheduleAssignment,
  seedDateOverride,
  seedDayOff,
  seedEmployee
} from '@/test-utils/db';
import { db } from '@/lib/db';
import { nationalHolidays } from '@/lib/db/schema/attendance';

import { resolveScheduleGridCell, resolveScheduleGridCells } from './cell-resolver';

const TEST_USER_ID = 'schedule-grid-resolver-user';
const OTHER_USER_ID = 'schedule-grid-resolver-other';

/** Insert a single national holiday row. */
async function seedHoliday(args: {
  date: string;
  name: string;
  isRecurring?: boolean;
}): Promise<void> {
  await db.insert(nationalHolidays).values({
    date: args.date,
    name: args.name,
    is_recurring: args.isRecurring ?? false
  });
}

describe('schedule-grid cell resolver (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('parity: read-path cell === single-cell re-resolve', () => {
    /** Build a window that mirrors the grid's Monday-anchored 7-day week. */
    function weekDates(start: string): string[] {
      const out: string[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(`${start}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i);
        out.push(d.toISOString().slice(0, 10));
      }
      return out;
    }

    it('returns the same cell for a fresh read window and a single-cell re-resolve', async () => {
      // Two users, one shift, one rule, varied override/day-off/assignment
      // state across 7 days so every precedence branch is exercised.
      const shiftA = await seedShift({
        id: 1,
        name: 'Morning',
        late_tolerance_minutes: 5,
        absence_cutoff_minutes: 60
      });
      const shiftB = await seedShift({
        id: 2,
        name: 'Evening',
        late_tolerance_minutes: 10,
        absence_cutoff_minutes: 90
      });
      const shiftWithoutPolicy = await seedShift({
        id: 3,
        name: 'Night',
        // Both tolerance fields default to 0 in `seedShift`, which is
        // a real-world legal value but exercises the policy-resolved
        // branch; we instead leave shift 3 untouched policy-wise.
        late_tolerance_minutes: 0,
        absence_cutoff_minutes: 0
      });
      await seedShiftWeekdayRule(shiftA.id, {
        day_of_week: 1,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
      await seedShiftWeekdayRule(shiftA.id, {
        day_of_week: 2,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
      await seedShiftWeekdayRule(shiftB.id, {
        day_of_week: 1,
        is_working_day: true,
        start_time: '14:00',
        end_time: '22:00'
      });
      // shiftWithoutPolicy intentionally has no weekday rules — a date
      // override pointing at it on a working weekday should produce a
      // cell with `policyMissing: true`.
      await seedEmployee(TEST_USER_ID, { full_name: 'Resolver Test User' });
      await seedEmployee(OTHER_USER_ID, { full_name: 'Resolver Other User' });
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: shiftA.id,
        effective_from: '2026-01-01'
      });
      await seedScheduleAssignment({
        user_id: OTHER_USER_ID,
        shift_id: shiftB.id,
        effective_from: '2026-01-01'
      });
      await seedDateOverride({
        user_id: TEST_USER_ID,
        date: '2026-08-04',
        shift_id: shiftWithoutPolicy.id
      });
      await seedDayOff({
        user_id: TEST_USER_ID,
        date: '2026-08-05',
        reason: 'Cuti'
      });

      const weekStart = '2026-08-03'; // Monday
      const weekEnd = '2026-08-09'; // Sunday

      // READ side: a 7-day window through `resolveScheduleGridCells`.
      const batch = await resolveScheduleGridCells({
        userIds: [TEST_USER_ID, OTHER_USER_ID],
        startDate: weekStart,
        endDate: weekEnd
      });

      // WRITE-re-resolve side: each individual (user, date) re-resolved
      // through the N=1 wrapper.
      for (const date of weekDates(weekStart)) {
        for (const userId of [TEST_USER_ID, OTHER_USER_ID]) {
          const fromBatch = batch.byUser.get(userId)!.cells.get(date)!;
          const fromSingle = await resolveScheduleGridCell(userId, date);
          expect(fromSingle).toStrictEqual(fromBatch);
        }
      }
    });

    it('returns identical cell content for a single-cell re-resolve regardless of how many other users are in the window', async () => {
      // Verifies that the N=1 wrapper is total — adding more users to the
      // window does NOT change the resolved cell for the user we care about.
      await seedShift({ id: 1, name: 'Morning' });
      await seedShiftWeekdayRule(1, {
        day_of_week: 1,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
      await seedEmployee(TEST_USER_ID);
      await seedEmployee('noise-user-1');
      await seedEmployee('noise-user-2');
      await seedEmployee('noise-user-3');
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: 1,
        effective_from: '2026-01-01'
      });

      const lone = await resolveScheduleGridCell(TEST_USER_ID, '2026-08-03');
      const noisyWindow = await resolveScheduleGridCells({
        userIds: [TEST_USER_ID, 'noise-user-1', 'noise-user-2', 'noise-user-3'],
        startDate: '2026-08-03',
        endDate: '2026-08-03'
      });
      expect(noisyWindow.byUser.get(TEST_USER_ID)!.cells.get('2026-08-03')).toStrictEqual(lone);
    });
  });

  describe('recurring-holiday projection (the bug that motivated the refactor)', () => {
    it('projects a recurring holiday onto its exact anniversary inside the window, not onto the stored MM-DD', async () => {
      // Stored as recurring 08-21. The helper matches by month, so for an
      // August window it returns the row at every query; the resolver must
      // place the holiday on the day that actually contains MM-DD=08-21.
      await seedShift({ id: 1, name: 'Morning' });
      await seedShiftWeekdayRule(1, {
        day_of_week: 1,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
      await seedEmployee(TEST_USER_ID);
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: 1,
        effective_from: '2026-01-01'
      });
      await seedHoliday({
        // Encoded against a fixed year so the row is unique on date alone
        // (the table has no id surrogate). `is_recurring=true` flips the
        // SQL to the month-only matcher.
        date: '1999-08-21',
        name: 'Hari Merdeka',
        isRecurring: true
      });

      const cells = await resolveScheduleGridCells({
        userIds: [TEST_USER_ID],
        startDate: '2026-08-03',
        endDate: '2026-08-09'
      });

      // The expected holiday map should mark 2026-08-21 only — but Aug 21
      // is outside the visible week, so the holiday is absent from the
      // WINDOW map and absent from every cell inside it. The point of
      // this test is that the helper DOES NOT erroneously mark unrelated
      // August days (e.g. Aug 4, Aug 5, Aug 6) just because they share a
      // month with the recurring row.
      expect(cells.holidaysByDate).toEqual({});
      for (const date of ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']) {
        expect(cells.byUser.get(TEST_USER_ID)!.cells.get(date)!.isHoliday).toBe(false);
        expect(cells.byUser.get(TEST_USER_ID)!.cells.get(date)!.holidayName).toBeNull();
      }
    });

    it('places a recurring holiday onto the exact day it falls on inside the window', async () => {
      // Mirror of the previous test, but with a recurring MM-DD that
      // happens to fall INSIDE the August window. The cell on the exact
      // day must be a holiday; the cell on every other day must NOT be.
      await seedShift({ id: 1, name: 'Morning' });
      await seedShiftWeekdayRule(1, {
        day_of_week: 1,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
      await seedEmployee(TEST_USER_ID);
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: 1,
        effective_from: '2026-01-01'
      });
      await seedHoliday({
        date: '1999-08-05',
        name: 'Hari Recurring',
        isRecurring: true
      });

      const cells = await resolveScheduleGridCells({
        userIds: [TEST_USER_ID],
        startDate: '2026-08-03',
        endDate: '2026-08-09'
      });

      expect(cells.holidaysByDate).toEqual({ '2026-08-05': 'Hari Recurring' });
      const onDay = cells.byUser.get(TEST_USER_ID)!.cells.get('2026-08-05')!;
      expect(onDay.isHoliday).toBe(true);
      expect(onDay.holidayName).toBe('Hari Recurring');
      for (const date of [
        '2026-08-03',
        '2026-08-04',
        '2026-08-06',
        '2026-08-07',
        '2026-08-08',
        '2026-08-09'
      ]) {
        expect(cells.byUser.get(TEST_USER_ID)!.cells.get(date)!.isHoliday).toBe(false);
      }
    });

    it('uses the single-cell wrapper to recover the same holiday flag (write-side parity)', async () => {
      // The write-path re-resolve is `resolveScheduleGridCell` at N=1. The
      // bug we're locking down was that the old single-cell path took the
      // raw helper output without projecting; recurring holidays matched
      // by MONTH would leak onto unrelated same-month days. Here the
      // recurring MM-DD is 08-15, and the wrapper's N=1 window IS
      // 2026-08-15 — the holiday lands on the only cell the wrapper
      // emits, so it must be marked.
      await seedShift({ id: 1, name: 'Morning' });
      await seedShiftWeekdayRule(1, {
        day_of_week: 1,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
      await seedEmployee(TEST_USER_ID);
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: 1,
        effective_from: '2026-01-01'
      });
      await seedHoliday({
        date: '1999-08-15',
        name: 'Hari Recurring Mid',
        isRecurring: true
      });

      const cellOnActualDay = await resolveScheduleGridCell(TEST_USER_ID, '2026-08-15');
      expect(cellOnActualDay.isHoliday).toBe(true);
      expect(cellOnActualDay.holidayName).toBe('Hari Recurring Mid');

      // AND the same N=1 wrapper on a DIFFERENT August day inside the
      // same month must NOT flag it — the projection places the holiday
      // exactly on 2026-08-15, nowhere else.
      const cellOnOtherAugustDay = await resolveScheduleGridCell(TEST_USER_ID, '2026-08-12');
      expect(cellOnOtherAugustDay.isHoliday).toBe(false);
      expect(cellOnOtherAugustDay.holidayName).toBeNull();
    });
  });
});

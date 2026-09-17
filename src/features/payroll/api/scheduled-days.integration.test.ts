/**
 * Integration tests for Opsi B read-side hardening of `getScheduledDays`
 * (payroll scheduled-day counting over `schedule_assignments`).
 *
 * The shared `effectiveDuring` helper semantics are intentionally untouched
 * (payroll tables rely on them); the schedule-specific non-inverted predicate
 * is ANDed in at the `schedule_assignments` call site in `scheduled-days.ts`.
 *
 * Two levels are pinned:
 *  - SQL level: `listScheduleAssignmentsDuring` must not return a pre-existing
 *    inverted row that overlaps the period under the old overlap-only filter
 *    (this assertion fails without the fix);
 *  - count level: the day count is driven by the valid assignment.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { scheduleAssignments } from '@/lib/db/schema/attendance';
import { resetAllTables, seedShift, seedShiftWeekdayRule } from '@/test-utils/db';
import { withInvertedRangeRows } from '@/test-utils/schedule-range';
import { getScheduledDays, listScheduleAssignmentsDuring } from './scheduled-days';
import { asDateISO, type DateISO } from './date-iso';

const TEST_USER_ID = 'scheduled-days-inverted-user';

async function countInPeriod(employeeId: string, start: DateISO, end: DateISO) {
  return db.transaction((tx) => getScheduledDays(tx, employeeId, start, end));
}

async function fetchInPeriod(employeeId: string, start: DateISO, end: DateISO) {
  return db.transaction((tx) => listScheduleAssignmentsDuring(tx, employeeId, start, end));
}

describe('getScheduledDays — inverted-row hardening (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('excludes a coexisting inverted row at the SQL level and counts from the valid assignment', async () => {
    const staleShift = await seedShift({ name: 'Inverted' });
    const validShift = await seedShift({ name: 'Valid' });
    for (let dow = 0; dow <= 6; dow += 1) {
      await seedShiftWeekdayRule(validShift.id, {
        day_of_week: dow,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
    }

    await withInvertedRangeRows(async () => {
      // The inverted row (09-12 → 09-10) overlaps the period 2026-09-01..
      // 2026-09-30 under the OLD overlap-only SQL (from 09-12 <= 09-30 ✓,
      // to 09-10 >= 09-01 ✓), so it is returned pre-fix and must be filtered.
      await db.insert(scheduleAssignments).values({
        user_id: TEST_USER_ID,
        shift_id: staleShift.id,
        effective_from: '2026-09-12',
        effective_to: '2026-09-10'
      });
      await db.insert(scheduleAssignments).values({
        user_id: TEST_USER_ID,
        shift_id: validShift.id,
        effective_from: '2026-09-08',
        effective_to: '2026-09-30'
      });

      const periodStart = asDateISO('2026-09-01');
      const periodEnd = asDateISO('2026-09-30');

      // SQL level — the fix pin: only the valid row survives the fetch.
      const rows = await fetchInPeriod(TEST_USER_ID, periodStart, periodEnd);
      expect(rows.map((row) => row.shift_id)).toEqual([validShift.id]);
      expect(
        rows.every((row) => row.effective_to == null || row.effective_from <= row.effective_to)
      ).toBe(true);

      // Count level: 2026-09-08 .. 2026-09-30 inclusive = 23 days, all working.
      expect(await countInPeriod(TEST_USER_ID, periodStart, periodEnd)).toBe(23);
    });
  });

  it('counts the full period for a plain bounded assignment (predicate no-op)', async () => {
    const shift = await seedShift({ name: 'Plain' });
    for (let dow = 0; dow <= 6; dow += 1) {
      await seedShiftWeekdayRule(shift.id, {
        day_of_week: dow,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
    }
    await db.insert(scheduleAssignments).values({
      user_id: TEST_USER_ID,
      shift_id: shift.id,
      effective_from: '2026-09-01',
      effective_to: '2026-09-30'
    });

    const days = await countInPeriod(
      TEST_USER_ID,
      asDateISO('2026-09-01'),
      asDateISO('2026-09-30')
    );
    expect(days).toBe(30);
  });
});

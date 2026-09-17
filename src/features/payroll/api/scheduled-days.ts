import { and, eq, gte, lte } from 'drizzle-orm';
import {
  dateOverrides,
  dayOffs,
  scheduleAssignments,
  shiftWeekdayRules
} from '@/lib/db/schema/attendance';
import type { PayrollTransaction } from '@/lib/db/payroll';
import { scheduleAssignmentRangeValid } from '@/lib/db/attendance';
import type { DateISO } from './date-iso';
import { dateOnly, effectiveDuring } from './shared';

/**
 * Schedule assignments overlapping `[periodStart, periodEnd]` for one employee.
 *
 * The shared `effectiveDuring` helper keeps its payroll-wide semantics; the
 * schedule-specific non-inverted predicate is ANDed in here (Opsi B): an
 * inverted row (`effective_from > effective_to`) is an empty range but still
 * matches the overlap filter, so it must not reach the day loop. Exported so
 * integration tests can assert the SQL-level exclusion directly instead of
 * inferring it from the returned count.
 */
export async function listScheduleAssignmentsDuring(
  tx: PayrollTransaction,
  employeeId: string,
  periodStart: DateISO,
  periodEnd: DateISO
) {
  return (await tx
    .select()
    .from(scheduleAssignments)
    .where(
      and(
        eq(scheduleAssignments.user_id, employeeId),
        effectiveDuring(scheduleAssignments, periodStart, periodEnd),
        scheduleAssignmentRangeValid()
      )
    )) as Array<typeof scheduleAssignments.$inferSelect>;
}

export async function getScheduledDays(
  tx: PayrollTransaction,
  employeeId: string,
  periodStart: DateISO,
  periodEnd: DateISO
) {
  const assignments = await listScheduleAssignmentsDuring(tx, employeeId, periodStart, periodEnd);
  const rules = await tx.select().from(shiftWeekdayRules);
  const overrides = await tx
    .select()
    .from(dateOverrides)
    .where(
      and(
        eq(dateOverrides.user_id, employeeId),
        gte(dateOverrides.date, periodStart),
        lte(dateOverrides.date, periodEnd)
      )
    );
  const daysOff = await tx
    .select({ date: dayOffs.date })
    .from(dayOffs)
    .where(
      and(
        eq(dayOffs.user_id, employeeId),
        gte(dayOffs.date, periodStart),
        lte(dayOffs.date, periodEnd)
      )
    );
  const overrideByDate = new Map(overrides.map((row) => [row.date, row.shift_id]));
  const daysOffSet = new Set(daysOff.map((row) => row.date));
  let scheduledDays = 0;
  for (
    let cursor = dateOnly(periodStart);
    cursor <= dateOnly(periodEnd);
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    if (daysOffSet.has(date)) continue;
    // The `effective_from <= effective_to` conjunct mirrors the SQL
    // predicate above so a pre-existing inverted row can never match here
    // even if it reaches this loop through another path.
    const assignment = assignments.find(
      (row) =>
        row.effective_from <= date &&
        row.effective_to >= date &&
        row.effective_from <= row.effective_to
    );
    const shiftId = overrideByDate.get(date) ?? assignment?.shift_id;
    const rule = rules.find(
      (row) => row.shift_id === shiftId && row.day_of_week === cursor.getUTCDay()
    );
    if (rule?.is_working_day) scheduledDays += 1;
  }
  return scheduledDays;
}

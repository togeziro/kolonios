import { and, eq, gte, lte } from 'drizzle-orm';
import {
  dateOverrides,
  dayOffs,
  scheduleAssignments,
  shiftWeekdayRules
} from '@/lib/db/schema/attendance';
import type { PayrollTransaction } from '@/lib/db/payroll';
import type { DateISO } from './date-iso';
import { dateOnly, effectiveDuring } from './shared';

export async function getScheduledDays(
  tx: PayrollTransaction,
  employeeId: string,
  periodStart: DateISO,
  periodEnd: DateISO
) {
  const assignments = (await tx
    .select()
    .from(scheduleAssignments)
    .where(
      and(
        eq(scheduleAssignments.user_id, employeeId),
        effectiveDuring(scheduleAssignments, periodStart, periodEnd)
      )
    )) as Array<typeof scheduleAssignments.$inferSelect>;
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
    const assignment = assignments.find(
      (row) => row.effective_from <= date && (!row.effective_to || row.effective_to >= date)
    );
    const shiftId = overrideByDate.get(date) ?? assignment?.shift_id;
    const rule = rules.find(
      (row) => row.shift_id === shiftId && row.day_of_week === cursor.getUTCDay()
    );
    if (rule?.is_working_day) scheduledDays += 1;
  }
  return scheduledDays;
}

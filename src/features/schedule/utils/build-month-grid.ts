import {
  resolveEffectiveSchedule,
  pickCoveringAssignment,
  type ScheduleAssignment,
  type WeekdayScheduleRule,
  type DateOverride
} from '@/lib/attendance/schedule';
import { daysInMonth } from '@/lib/dates';
import type { ScheduleMonthData } from '@/lib/db/attendance';

export type MonthGridCell = {
  date: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  lateToleranceMinutes: number;
  shiftName: string | null;
  isDayOff: boolean;
  isHoliday: boolean;
  holidayName: string | null;
};

export function buildMonthGrid(month: string, data: ScheduleMonthData): MonthGridCell[] {
  const [y, m] = month.split('-').map(Number);
  const total = daysInMonth(month);

  const dayOffSet = new Set(data.dayOffs);
  const holidayMap = new Map(data.holidays.map((h) => [h.date, h.name]));
  const overrideMap = new Map(data.overrides.map((o) => [o.date, o.shiftId]));
  const shiftNameById = new Map(data.assignments.map((a) => [a.shiftId, a.shiftName]));

  const rulesByShift = new Map<number, WeekdayScheduleRule[]>();
  for (const r of data.weekdayRules) {
    const list = rulesByShift.get(r.shiftId) ?? [];
    list.push({
      dayOfWeek: r.dayOfWeek,
      isWorkingDay: r.isWorkingDay,
      startTime: r.startTime,
      endTime: r.endTime
    });
    rulesByShift.set(r.shiftId, list);
  }

  const cells: MonthGridCell[] = [];
  for (let d = 1; d <= total; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;

    // A month can hold several assignment ranges; resolve each day against the
    // one that covers it (most recent `effective_from` wins). Borrowing a
    // single "latest" range would blank out every earlier range.
    const matching = pickCoveringAssignment(data.assignments, date);
    const assignment: ScheduleAssignment | null = matching
      ? {
          userId: '',
          shiftId: matching.shiftId,
          effectiveFrom: matching.effectiveFrom,
          effectiveTo: matching.effectiveTo
        }
      : null;

    const overrideShiftId = overrideMap.get(date);
    const override: DateOverride | undefined =
      overrideShiftId != null ? { date, shiftId: overrideShiftId } : undefined;

    const resolved = resolveEffectiveSchedule({
      assignment,
      // Weekday hours come from the covering assignment's shift (parity with
      // the admin grid); a date override only swaps the shift policy.
      weekdayRules: matching ? (rulesByShift.get(matching.shiftId) ?? []) : [],
      shiftPolicies: data.shiftPolicies ?? [],
      dateOverrides: override ? [override] : [],
      dayOffs: dayOffSet.has(date) ? [date] : [],
      date
    });

    const isDayOff = dayOffSet.has(date);
    const holidayName = holidayMap.get(date) ?? null;

    cells.push({
      date,
      dayOfWeek: new Date(y, m - 1, d).getDay(),
      isWorkingDay: resolved?.isWorkingDay === true && !isDayOff,
      startTime: resolved?.startTime ?? null,
      endTime: resolved?.endTime ?? null,
      lateToleranceMinutes: resolved?.lateToleranceMinutes ?? 0,
      shiftName: resolved ? (shiftNameById.get(resolved.shiftId) ?? null) : null,
      isDayOff,
      isHoliday: holidayName !== null,
      holidayName
    });
  }
  return cells;
}

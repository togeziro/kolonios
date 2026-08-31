import {
  resolveEffectiveSchedule,
  type ScheduleAssignment,
  type WeekdayScheduleRule,
  type DateOverride
} from '@/lib/attendance/schedule';
import type { ScheduleMonthData, ScheduleWeekdayRuleRow } from '@/lib/db/attendance';

export type MonthGridCell = {
  date: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  lateToleranceMinutes: number;
  isDayOff: boolean;
  isHoliday: boolean;
  holidayName: string | null;
};

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function buildMonthGrid(month: string, data: ScheduleMonthData): MonthGridCell[] {
  const [y, m] = month.split('-').map(Number);
  const total = daysInMonth(month);

  const dayOffSet = new Set(data.dayOffs);
  const holidayMap = new Map(data.holidays.map((h) => [h.date, h.name]));
  const overrideMap = new Map(data.overrides.map((o) => [o.date, o.shiftId]));

  const assignment: ScheduleAssignment | null = data.assignment
    ? {
        userId: '',
        shiftId: data.assignment.shiftId,
        effectiveFrom: data.assignment.effectiveFrom,
        effectiveTo: data.assignment.effectiveTo
      }
    : null;
  const weekdayRules: WeekdayScheduleRule[] = data.weekdayRules.map(
    (r: ScheduleWeekdayRuleRow) => ({
      dayOfWeek: r.dayOfWeek,
      isWorkingDay: r.isWorkingDay,
      startTime: r.startTime,
      endTime: r.endTime
    })
  );

  const cells: MonthGridCell[] = [];
  for (let d = 1; d <= total; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const override: DateOverride | undefined = overrideMap.has(date)
      ? { date, shiftId: overrideMap.get(date)! }
      : undefined;

    const resolved = resolveEffectiveSchedule({
      assignment,
      weekdayRules,
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
      isDayOff,
      isHoliday: holidayName !== null,
      holidayName
    });
  }
  return cells;
}

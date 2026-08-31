import {
  resolveEffectiveSchedule,
  type DateOverride,
  type ScheduleAssignment,
  type ShiftPolicy,
  type WeekdayScheduleRule
} from '@/lib/attendance/schedule';

export type ChecklistDayStatus = 'working' | 'no_schedule' | 'day_off' | 'holiday';

export type ChecklistScheduleSnapshot = {
  shiftId: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export type HolidayRow = { date: string; name: string; isRecurring: boolean };

export type ChecklistDayInput = {
  date: string; // YYYY-MM-DD business date
  assignment: Pick<ScheduleAssignment, 'shiftId' | 'effectiveFrom' | 'effectiveTo'> | null;
  weekdayRules: WeekdayScheduleRule[];
  shiftPolicies: ShiftPolicy[];
  overrides: DateOverride[];
  dayOffs: string[];
  holidays: HolidayRow[];
};

export type ChecklistDayResolution = {
  status: ChecklistDayStatus;
  schedule: ChecklistScheduleSnapshot | null;
};

function matchesHoliday(holidays: HolidayRow[], date: string): boolean {
  const monthDay = date.slice(5); // MM-DD
  return holidays.some((h) => h.date === date || (h.isRecurring && h.date.slice(5) === monthDay));
}

/**
 * Decides whether a Daily Checklist exists for this day, purely from schedule
 * data. Day-off wins over everything, then holiday, then the effective
 * schedule must resolve to a working day.
 */
export function resolveChecklistDay(input: ChecklistDayInput): ChecklistDayResolution {
  const { date } = input;

  if (input.dayOffs.includes(date)) {
    return { status: 'day_off', schedule: null };
  }

  if (matchesHoliday(input.holidays, date)) {
    return { status: 'holiday', schedule: null };
  }

  const effective = resolveEffectiveSchedule({
    assignment: input.assignment
      ? {
          userId: '',
          shiftId: input.assignment.shiftId,
          effectiveFrom: input.assignment.effectiveFrom,
          effectiveTo: input.assignment.effectiveTo
        }
      : null,
    weekdayRules: input.weekdayRules,
    shiftPolicies: input.shiftPolicies,
    dateOverrides: input.overrides,
    dayOffs: input.dayOffs,
    date
  });

  if (!effective) {
    return { status: 'no_schedule', schedule: null };
  }

  return {
    status: 'working',
    schedule: {
      shiftId: effective.shiftId,
      startTime: effective.startTime,
      endTime: effective.endTime
    }
  };
}

/**
 * Query factory for `listEligibleShiftsForDayFn`. Used by the cell popover
 * to populate its Shift dropdown with shifts that have a `shift_weekday_rules`
 * row for the requested day-of-week.
 */

import { useQuery } from '@tanstack/react-query';

import { listEligibleShiftsForDayFn, type EligibleShift } from './shifts-helper';

export const scheduleGridShiftsKeys = {
  eligibleForDay: (dayOfWeek: number) => ['schedule-grid', 'eligible-shifts', dayOfWeek] as const
};

export function eligibleShiftsForDayQueryOptions(dayOfWeek: number) {
  return {
    queryKey: scheduleGridShiftsKeys.eligibleForDay(dayOfWeek),
    queryFn: async () => {
      const res = await listEligibleShiftsForDayFn({ data: { dayOfWeek } });
      if (!res.success) return [] as EligibleShift[];
      return res.shifts;
    }
  };
}

export function useEligibleShiftsForDay(dayOfWeek: number) {
  return useQuery(eligibleShiftsForDayQueryOptions(dayOfWeek));
}

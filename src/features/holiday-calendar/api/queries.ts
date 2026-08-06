import { useQuery } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { getNationalHolidaysFn, getNationalHolidayFn, getHolidayApiSettingsFn } from './service';

export const holidayKeys = {
  all: ['holidays'] as const,
  lists: () => [...holidayKeys.all, 'list'] as const,
  list: (year?: number) => [...holidayKeys.lists(), year] as const,
  details: () => [...holidayKeys.all, 'detail'] as const,
  detail: (id: number) => [...holidayKeys.details(), id] as const,
  settings: () => [...holidayKeys.all, 'settings'] as const
};

export const nationalHolidaysQueryOptions = (year?: number) =>
  queryOptions({
    queryKey: holidayKeys.list(year),
    queryFn: () => getNationalHolidaysFn({ data: { year } })
  });

export const nationalHolidayQueryOptions = (id: number) =>
  queryOptions({
    queryKey: holidayKeys.detail(id),
    queryFn: () => getNationalHolidayFn({ data: { id } })
  });

export const holidayApiSettingsQueryOptions = () =>
  queryOptions({
    queryKey: holidayKeys.settings(),
    queryFn: () => getHolidayApiSettingsFn()
  });

// Hook for fetching national holidays
export function useNationalHolidays(year?: number) {
  return useQuery(nationalHolidaysQueryOptions(year));
}

// Hook for fetching holiday API settings
export function useHolidayApiSettings() {
  return useQuery(holidayApiSettingsQueryOptions());
}

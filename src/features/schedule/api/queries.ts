import { queryOptions } from '@tanstack/react-query';
import { getMyScheduleFn } from './service';

export const scheduleKeys = {
  all: ['schedule'] as const,
  month: (month: string) => [...scheduleKeys.all, 'month', month] as const
};

export const myScheduleQueryOptions = (month: string) =>
  queryOptions({
    queryKey: scheduleKeys.month(month),
    queryFn: () => getMyScheduleFn({ data: { month } })
  });

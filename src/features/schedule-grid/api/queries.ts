import { queryOptions } from '@tanstack/react-query';
import { getScheduleGridFn } from './service';
import type { ScheduleGridFilters } from './types';

/**
 * Cache-key namespace for the admin schedule grid.
 *
 * Deliberately separate from `attendanceKeys` / `scheduleKeys` so the
 * grid can be invalidated independently (the user-facing My Schedule and
 * the admin grid target different audiences and read different shapes).
 * Cross-feature invalidation is still allowed (see ticket spec):
 * `src/features/schedule-grid/**` may import `attendanceKeys` to invalidate
 * the assignments / effective-schedule namespaces after a write.
 */
export const scheduleGridKeys = {
  all: ['schedule-grid'] as const,
  week: (filters: ScheduleGridFilters) => [...scheduleGridKeys.all, 'week', filters] as const
};

export const scheduleGridQueryOptions = (filters: ScheduleGridFilters) =>
  queryOptions({
    queryKey: scheduleGridKeys.week(filters),
    queryFn: () => getScheduleGridFn({ data: filters })
  });

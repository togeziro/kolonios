import { queryOptions } from '@tanstack/react-query';
import {
  getMyAttendanceFn,
  getAttendanceHistoryFn,
  getMyLeavesFn,
  getPerformanceStatsFn,
  getLocationsFn,
  getShiftsFn,
  getAttendanceSummaryFn
} from './service';
import type { AttendanceFilters, LeaveFilters } from './types';

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: (date?: string) => [...attendanceKeys.all, 'today', date] as const,
  history: (filters: AttendanceFilters) => [...attendanceKeys.all, 'history', filters] as const,
  leaves: (filters: LeaveFilters) => [...attendanceKeys.all, 'leaves', filters] as const,
  performance: () => [...attendanceKeys.all, 'performance'] as const,
  locations: () => [...attendanceKeys.all, 'locations'] as const,
  shifts: () => [...attendanceKeys.all, 'shifts'] as const
};

export const myAttendanceQueryOptions = (date?: string) =>
  queryOptions({
    queryKey: attendanceKeys.today(date),
    queryFn: () => getMyAttendanceFn({ data: date })
  });

export const attendanceHistoryQueryOptions = (filters: AttendanceFilters) =>
  queryOptions({
    queryKey: attendanceKeys.history(filters),
    queryFn: () => getAttendanceHistoryFn({ data: filters })
  });

export const myLeavesQueryOptions = (filters: LeaveFilters) =>
  queryOptions({
    queryKey: attendanceKeys.leaves(filters),
    queryFn: () => getMyLeavesFn({ data: filters })
  });

export const performanceStatsQueryOptions = () =>
  queryOptions({
    queryKey: attendanceKeys.performance(),
    queryFn: () => getPerformanceStatsFn()
  });

export const locationsQueryOptions = () =>
  queryOptions({
    queryKey: attendanceKeys.locations(),
    queryFn: () => getLocationsFn()
  });

export const shiftsQueryOptions = () =>
  queryOptions({
    queryKey: attendanceKeys.shifts(),
    queryFn: () => getShiftsFn()
  });

export const attendanceSummaryQueryOptions = () =>
  queryOptions({
    queryKey: [...attendanceKeys.all, 'summary'] as const,
    queryFn: () => getAttendanceSummaryFn()
  });

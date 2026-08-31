import { queryOptions } from '@tanstack/react-query';
import {
  getMyAttendanceFn,
  getAttendanceHistoryFn,
  getMyLeavesFn,
  getPerformanceStatsFn,
  getLocationsFn,
  getShiftsFn,
  getAttendanceSummaryFn,
  getSchedulesFn,
  getScheduleAssignmentsFn,
  getAdminAttendanceReportFn,
  listShiftsFn
} from './service';
import type {
  AttendanceFilters,
  LeaveFilters,
  AssignmentFilters,
  AdminAttendanceFilters
} from './types';

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: (date?: string) => [...attendanceKeys.all, 'today', date] as const,
  history: (filters: AttendanceFilters) => [...attendanceKeys.all, 'history', filters] as const,
  leaves: (filters: LeaveFilters) => [...attendanceKeys.all, 'leaves', filters] as const,
  performance: () => [...attendanceKeys.all, 'performance'] as const,
  locations: () => [...attendanceKeys.all, 'locations'] as const,
  shifts: () => [...attendanceKeys.all, 'shifts'] as const,
  shiftsList: () => [...attendanceKeys.all, 'shifts-list'] as const,
  schedules: () => [...attendanceKeys.all, 'schedules'] as const,
  assignments: (filters: AssignmentFilters) =>
    [...attendanceKeys.all, 'assignments', filters] as const,
  effectiveSchedule: (date?: string) =>
    [...attendanceKeys.all, 'effective-schedule', date] as const,
  dayOffs: () => [...attendanceKeys.all, 'day-offs'] as const,
  corrections: () => [...attendanceKeys.all, 'corrections'] as const,
  adminReport: (filters: unknown) => [...attendanceKeys.all, 'admin-report', filters] as const
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

export const listShiftsQueryOptions = () =>
  queryOptions({
    queryKey: attendanceKeys.shiftsList(),
    queryFn: () => listShiftsFn()
  });

export const attendanceSummaryQueryOptions = () =>
  queryOptions({
    queryKey: [...attendanceKeys.all, 'summary'] as const,
    queryFn: () => getAttendanceSummaryFn()
  });

export const schedulesQueryOptions = () =>
  queryOptions({
    queryKey: attendanceKeys.schedules(),
    queryFn: () => getSchedulesFn()
  });

export const scheduleAssignmentsQueryOptions = (filters: AssignmentFilters) =>
  queryOptions({
    queryKey: attendanceKeys.assignments(filters),
    queryFn: () => getScheduleAssignmentsFn({ data: filters })
  });

export const adminAttendanceReportQueryOptions = (filters: AdminAttendanceFilters) =>
  queryOptions({
    queryKey: attendanceKeys.adminReport(filters),
    queryFn: () => getAdminAttendanceReportFn({ data: filters })
  });

import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getMyAttendanceFn: vi.fn(),
  getAttendanceHistoryFn: vi.fn(),
  getMyLeavesFn: vi.fn(),
  getPerformanceStatsFn: vi.fn(),
  getLocationsFn: vi.fn(),
  getShiftsFn: vi.fn(),
  getAttendanceSummaryFn: vi.fn(),
  getSchedulesFn: vi.fn(),
  getScheduleAssignmentsFn: vi.fn()
}));

import { attendanceKeys } from './queries';
import {
  attendanceHistoryQueryOptions,
  attendanceSummaryQueryOptions,
  locationsQueryOptions,
  myAttendanceQueryOptions,
  myLeavesQueryOptions,
  performanceStatsQueryOptions,
  shiftsQueryOptions
} from './queries';
import type { AttendanceFilters, LeaveFilters } from './types';
import {
  getAttendanceHistoryFn,
  getAttendanceSummaryFn,
  getLocationsFn,
  getMyAttendanceFn,
  getMyLeavesFn,
  getPerformanceStatsFn,
  getShiftsFn
} from './service';

describe('attendanceKeys', () => {
  it('shapes query keys', () => {
    expect(attendanceKeys.all).toEqual(['attendance']);
    expect(attendanceKeys.today('2026-07-31')).toEqual(['attendance', 'today', '2026-07-31']);
    expect(attendanceKeys.today()).toEqual(['attendance', 'today', undefined]);
    const historyFilters: AttendanceFilters = { month: 7 };
    expect(attendanceKeys.history(historyFilters)).toEqual([
      'attendance',
      'history',
      historyFilters
    ]);
    const leaveFilters: LeaveFilters = { status: 'pending' };
    expect(attendanceKeys.leaves(leaveFilters)).toEqual(['attendance', 'leaves', leaveFilters]);
    expect(attendanceKeys.performance()).toEqual(['attendance', 'performance']);
    expect(attendanceKeys.locations()).toEqual(['attendance', 'locations']);
    expect(attendanceKeys.shifts()).toEqual(['attendance', 'shifts']);
  });
});

describe('attendance query options', () => {
  it('myAttendanceQueryOptions passes the date through', () => {
    const options = myAttendanceQueryOptions('2026-07-31');
    expect(options.queryKey).toEqual(['attendance', 'today', '2026-07-31']);
    expect(options.queryFn).toBeTypeOf('function');
    options.queryFn!(undefined as never);
    expect(getMyAttendanceFn).toHaveBeenCalledWith({ data: '2026-07-31' });
  });

  it('attendanceHistoryQueryOptions passes filters through', () => {
    const filters: AttendanceFilters = { month: 7, year: 2026 };
    const options = attendanceHistoryQueryOptions(filters);
    expect(options.queryKey).toEqual(['attendance', 'history', filters]);
    options.queryFn!(undefined as never);
    expect(getAttendanceHistoryFn).toHaveBeenCalledWith({ data: filters });
  });

  it('myLeavesQueryOptions passes filters through', () => {
    const filters: LeaveFilters = { status: 'pending' };
    const options = myLeavesQueryOptions(filters);
    expect(options.queryKey).toEqual(['attendance', 'leaves', filters]);
    options.queryFn!(undefined as never);
    expect(getMyLeavesFn).toHaveBeenCalledWith({ data: filters });
  });

  it('performanceStatsQueryOptions calls without args', () => {
    const options = performanceStatsQueryOptions();
    expect(options.queryKey).toEqual(['attendance', 'performance']);
    options.queryFn!(undefined as never);
    expect(getPerformanceStatsFn).toHaveBeenCalledWith();
  });

  it('locationsQueryOptions calls without args', () => {
    const options = locationsQueryOptions();
    expect(options.queryKey).toEqual(['attendance', 'locations']);
    options.queryFn!(undefined as never);
    expect(getLocationsFn).toHaveBeenCalledWith();
  });

  it('shiftsQueryOptions calls without args', () => {
    const options = shiftsQueryOptions();
    expect(options.queryKey).toEqual(['attendance', 'shifts']);
    options.queryFn!(undefined as never);
    expect(getShiftsFn).toHaveBeenCalledWith();
  });

  it('attendanceSummaryQueryOptions uses the summary key', () => {
    const options = attendanceSummaryQueryOptions();
    expect(options.queryKey).toEqual(['attendance', 'summary']);
    options.queryFn!(undefined as never);
    expect(getAttendanceSummaryFn).toHaveBeenCalledWith();
  });
});

describe('attendanceKeys admin scheduling', () => {
  it('shapes schedule, assignment, and report keys', () => {
    expect(attendanceKeys.schedules()).toEqual(['attendance', 'schedules']);
    expect(attendanceKeys.assignments({})).toEqual(['attendance', 'assignments', {}]);
    expect(attendanceKeys.effectiveSchedule('2026-08-04')).toEqual([
      'attendance',
      'effective-schedule',
      '2026-08-04'
    ]);
    expect(attendanceKeys.dayOffs()).toEqual(['attendance', 'day-offs']);
    expect(attendanceKeys.corrections()).toEqual(['attendance', 'corrections']);
  });
});

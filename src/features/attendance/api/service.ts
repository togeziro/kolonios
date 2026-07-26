import { createServerFn } from '@tanstack/react-start';
import { requireRole } from '@/lib/auth/session';
import {
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  attendanceFiltersSchema,
  dateParamSchema,
  leaveRequestSchema,
  leaveFiltersSchema
} from './validation';

export const checkInFn = createServerFn({ method: 'POST' })
  .validator(attendanceCheckInSchema)
  .handler(async ({ data }) => {
    const session = await requireRole('employee');
    const { checkIn } = await import('@/lib/db/attendance');
    return checkIn(session.user.id, data);
  });

export const checkOutFn = createServerFn({ method: 'POST' })
  .validator(attendanceCheckOutSchema)
  .handler(async ({ data }) => {
    const session = await requireRole('employee');
    const { checkOut } = await import('@/lib/db/attendance');
    return checkOut(session.user.id, data);
  });

export const getMyAttendanceFn = createServerFn({ method: 'GET' })
  .validator(dateParamSchema)
  .handler(async ({ data: date }) => {
    const session = await requireRole('employee');
    const { getEmployeeAttendance } = await import('@/lib/db/attendance');
    return getEmployeeAttendance(session.user.id, date);
  });

export const getAttendanceHistoryFn = createServerFn({ method: 'GET' })
  .validator(attendanceFiltersSchema)
  .handler(async ({ data: filters }) => {
    const session = await requireRole('employee');
    const { getAttendanceHistory } = await import('@/lib/db/attendance');
    return getAttendanceHistory(session.user.id, filters);
  });

export const getMyLeavesFn = createServerFn({ method: 'GET' })
  .validator(leaveFiltersSchema)
  .handler(async ({ data: filters }) => {
    const session = await requireRole('employee');
    const { getMyLeaves } = await import('@/lib/db/attendance');
    return getMyLeaves(session.user.id, filters);
  });

export const createLeaveRequestFn = createServerFn({ method: 'POST' })
  .validator(leaveRequestSchema)
  .handler(async ({ data }) => {
    const session = await requireRole('employee');
    const { createLeaveRequest } = await import('@/lib/db/attendance');
    return createLeaveRequest(session.user.id, data);
  });

export const getPerformanceStatsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireRole('employee');
  const { getPerformanceStats } = await import('@/lib/db/attendance');
  return getPerformanceStats(session.user.id);
});

export const getLocationsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireRole('employee');
  const { getLocations } = await import('@/lib/db/attendance');
  return getLocations();
});

export const getShiftsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireRole('employee');
  const { getShifts } = await import('@/lib/db/attendance');
  return getShifts();
});

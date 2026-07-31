import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequestContext } from '@/lib/request-id';
import { withAudit } from '@/lib/audit';
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
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'view');
      await checkRateLimit(`write:${session.user.id}`);
      const { checkIn } = await import('@/lib/db/attendance');
      const shift = await checkIn(session.user.id, data);
      await withAudit(
        session.user.id,
        {
          action: 'attendance.checkin',
          entityType: 'attendance',
          entityId: session.user.id,
          before: null,
          after: shift
        },
        async () => undefined
      );
      return shift;
    })
  );

export const checkOutFn = createServerFn({ method: 'POST' })
  .validator(attendanceCheckOutSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'view');
      await checkRateLimit(`write:${session.user.id}`);
      const { checkOut } = await import('@/lib/db/attendance');
      const shift = await checkOut(session.user.id, data);
      await withAudit(
        session.user.id,
        {
          action: 'attendance.checkout',
          entityType: 'attendance',
          entityId: session.user.id,
          before: null,
          after: shift
        },
        async () => undefined
      );
      return shift;
    })
  );

export const getMyAttendanceFn = createServerFn({ method: 'GET' })
  .validator(dateParamSchema)
  .handler(async ({ data: date }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'view');
      const { getEmployeeAttendance } = await import('@/lib/db/attendance');
      return getEmployeeAttendance(session.user.id, date);
    })
  );

export const getAttendanceHistoryFn = createServerFn({ method: 'GET' })
  .validator(attendanceFiltersSchema)
  .handler(async ({ data: filters }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'view');
      const { getAttendanceHistory } = await import('@/lib/db/attendance');
      return getAttendanceHistory(session.user.id, filters);
    })
  );

export const getMyLeavesFn = createServerFn({ method: 'GET' })
  .validator(leaveFiltersSchema)
  .handler(async ({ data: filters }) =>
    withRequestContext(async () => {
      const session = await requirePermission('leave', 'view');
      const { getMyLeaves } = await import('@/lib/db/attendance');
      return getMyLeaves(session.user.id, filters);
    })
  );

export const createLeaveRequestFn = createServerFn({ method: 'POST' })
  .validator(leaveRequestSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('leave', 'view');
      await checkRateLimit(`write:${session.user.id}`);
      const { createLeaveRequest } = await import('@/lib/db/attendance');
      return createLeaveRequest(session.user.id, data);
    })
  );

export const getPerformanceStatsFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    const session = await requirePermission('attendance', 'view');
    const { getPerformanceStats } = await import('@/lib/db/attendance');
    return getPerformanceStats(session.user.id);
  })
);

export const getLocationsFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    await requirePermission('attendance', 'view');
    const { getLocations } = await import('@/lib/db/attendance');
    return getLocations();
  })
);

export const getShiftsFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    await requirePermission('attendance', 'view');
    const { getShifts } = await import('@/lib/db/attendance');
    return getShifts();
  })
);

export const getAttendanceSummaryFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    const session = await requirePermission('attendance', 'view');
    const { getAttendanceSummary } = await import('@/lib/db/attendance');
    return getAttendanceSummary(session.user.id);
  })
);

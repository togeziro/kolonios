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
  leaveFiltersSchema,
  locationCreateSchema,
  locationUpdateSchema,
  locationDeleteSchema,
  scheduleCreateSchema,
  scheduleUpdateSchema,
  assignmentFiltersSchema,
  scheduleAssignmentSchema,
  bulkAssignmentSchema,
  dateOverrideSchema,
  dayOffSchema,
  dayOffDeleteSchema,
  correctionRequestSchema,
  correctionReviewSchema
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

// --- Location management ---

export const createLocationFn = createServerFn({ method: 'POST' })
  .validator(locationCreateSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { createLocation } = await import('@/lib/db/attendance');
      const result = await createLocation({ ...data, createdBy: session.user.id });
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.location.create',
            entityType: 'location',
            entityId: String(result.location?.id),
            before: null,
            after: result.location
          },
          async () => undefined
        );
      }
      return result;
    })
  );

export const updateLocationFn = createServerFn({ method: 'POST' })
  .validator(locationUpdateSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { updateLocation } = await import('@/lib/db/attendance');
      const { id, ...patch } = data;
      return updateLocation(id, patch, session.user.id);
    })
  );

export const deleteLocationFn = createServerFn({ method: 'POST' })
  .validator(locationDeleteSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'delete');
      await checkRateLimit(`write:${session.user.id}`);
      const { deleteLocation } = await import('@/lib/db/attendance');
      return deleteLocation(data.id);
    })
  );

// --- Schedule management ---

export const getSchedulesFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    await requirePermission('attendance', 'view');
    const { getShifts } = await import('@/lib/db/attendance');
    return getShifts();
  })
);

export const createScheduleFn = createServerFn({ method: 'POST' })
  .validator(scheduleCreateSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { createSchedule } = await import('@/lib/db/attendance');
      return createSchedule(data);
    })
  );

export const updateScheduleFn = createServerFn({ method: 'POST' })
  .validator(scheduleUpdateSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { updateSchedule } = await import('@/lib/db/attendance');
      const { id, ...patch } = data;
      return updateSchedule(id, patch);
    })
  );

// --- Assignments ---

export const getScheduleAssignmentsFn = createServerFn({ method: 'GET' })
  .validator(assignmentFiltersSchema)
  .handler(async ({ data: filters }) =>
    withRequestContext(async () => {
      await requirePermission('attendance', 'view');
      const { listScheduleAssignments } = await import('@/lib/db/attendance');
      return listScheduleAssignments(filters);
    })
  );

export const assignScheduleFn = createServerFn({ method: 'POST' })
  .validator(scheduleAssignmentSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { createScheduleAssignment } = await import('@/lib/db/attendance');
      return createScheduleAssignment({
        userId: data.userId,
        shiftId: data.shiftId,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
        createdBy: session.user.id
      });
    })
  );

export const bulkAssignScheduleFn = createServerFn({ method: 'POST' })
  .validator(bulkAssignmentSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { bulkAssignSchedule } = await import('@/lib/db/attendance');
      return bulkAssignSchedule(data.assignments, session.user.id);
    })
  );

// --- Overrides and day offs ---

export const createScheduleOverrideFn = createServerFn({ method: 'POST' })
  .validator(dateOverrideSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { db } = await import('@/lib/db');
      const { dateOverrides } = await import('@/lib/db/schema/attendance');
      const [record] = await db
        .insert(dateOverrides)
        .values({
          user_id: data.userId,
          date: data.date,
          shift_id: data.shiftId,
          created_by: session.user.id
        })
        .returning();
      return { success: true, override: record };
    })
  );

export const createDayOffFn = createServerFn({ method: 'POST' })
  .validator(dayOffSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { createDayOff } = await import('@/lib/db/attendance');
      return createDayOff({ userId: data.userId, date: data.date, createdBy: session.user.id });
    })
  );

export const deleteDayOffFn = createServerFn({ method: 'POST' })
  .validator(dayOffDeleteSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'delete');
      await checkRateLimit(`write:${session.user.id}`);
      const { deleteDayOff } = await import('@/lib/db/attendance');
      return deleteDayOff(data.id);
    })
  );

// --- Corrections ---

export const requestAttendanceCorrectionFn = createServerFn({ method: 'POST' })
  .validator(correctionRequestSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'view');
      await checkRateLimit(`write:${session.user.id}`);
      const { requestAttendanceCorrection } = await import('@/lib/db/attendance');
      return requestAttendanceCorrection(session.user.id, data);
    })
  );

export const reviewAttendanceCorrectionFn = createServerFn({ method: 'POST' })
  .validator(correctionReviewSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { reviewAttendanceCorrection } = await import('@/lib/db/attendance');
      const result = await reviewAttendanceCorrection(session.user.id, data);
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.correction.review',
            entityType: 'attendance',
            entityId: String(data.attendanceId),
            before: null,
            after: result.attendance
          },
          async () => undefined
        );
      }
      return result;
    })
  );

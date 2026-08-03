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
  correctionReviewSchema,
  reportFiltersSchema,
  exportReportSchema
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
      const result = await updateLocation(id, patch, session.user.id);
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.location.update',
            entityType: 'location',
            entityId: String(id),
            before: null,
            after: result.location
          },
          async () => undefined
        );
      }
      return result;
    })
  );

export const deleteLocationFn = createServerFn({ method: 'POST' })
  .validator(locationDeleteSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'delete');
      await checkRateLimit(`write:${session.user.id}`);
      const { deleteLocation } = await import('@/lib/db/attendance');
      const result = await deleteLocation(data.id);
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.location.delete',
            entityType: 'location',
            entityId: String(data.id),
            before: null,
            after: null
          },
          async () => undefined
        );
      }
      return result;
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
      const result = await createSchedule(data);
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.schedule.create',
            entityType: 'schedule',
            entityId: String(result.shift?.id),
            before: null,
            after: result.shift
          },
          async () => undefined
        );
      }
      return result;
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
      const result = await updateSchedule(id, patch);
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.schedule.update',
            entityType: 'schedule',
            entityId: String(id),
            before: null,
            after: result
          },
          async () => undefined
        );
      }
      return result;
    })
  );

// --- Assignments ---

export const getScheduleAssignmentsFn = createServerFn({ method: 'GET' })
  .validator(assignmentFiltersSchema)
  .handler(async ({ data: filters }) =>
    withRequestContext(async () => {
      await requirePermission('attendance', 'edit');
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
      const result = await createScheduleAssignment({
        userId: data.userId,
        shiftId: data.shiftId,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
        createdBy: session.user.id
      });
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.assignment.create',
            entityType: 'schedule_assignment',
            entityId: String(result.assignment?.id),
            before: null,
            after: result.assignment
          },
          async () => undefined
        );
      }
      return result;
    })
  );

export const bulkAssignScheduleFn = createServerFn({ method: 'POST' })
  .validator(bulkAssignmentSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { bulkAssignSchedule } = await import('@/lib/db/attendance');
      const result = await bulkAssignSchedule(data.assignments, session.user.id);
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.assignment.bulk_create',
            entityType: 'schedule_assignment',
            entityId: undefined,
            before: null,
            after: result
          },
          async () => undefined
        );
      }
      return result;
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
      await withAudit(
        session.user.id,
        {
          action: 'attendance.override.create',
          entityType: 'date_override',
          entityId: String(record.id),
          before: null,
          after: record
        },
        async () => undefined
      );
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
      const result = await createDayOff({
        userId: data.userId,
        date: data.date,
        createdBy: session.user.id
      });
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.day_off.create',
            entityType: 'day_off',
            entityId: String(result.dayOff?.id),
            before: null,
            after: result.dayOff
          },
          async () => undefined
        );
      }
      return result;
    })
  );

export const deleteDayOffFn = createServerFn({ method: 'POST' })
  .validator(dayOffDeleteSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('attendance', 'delete');
      await checkRateLimit(`write:${session.user.id}`);
      const { deleteDayOff } = await import('@/lib/db/attendance');
      const result = await deleteDayOff(data.id);
      if (result.success) {
        await withAudit(
          session.user.id,
          {
            action: 'attendance.day_off.delete',
            entityType: 'day_off',
            entityId: String(data.id),
            before: null,
            after: null
          },
          async () => undefined
        );
      }
      return result;
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

// --- Admin reports and export ---

export const getAdminAttendanceReportFn = createServerFn({ method: 'GET' })
  .validator(reportFiltersSchema)
  .handler(async ({ data: filters }) =>
    withRequestContext(async () => {
      await requirePermission('attendance', 'edit');
      const { getAdminAttendanceReport } = await import('@/lib/db/attendance');
      return getAdminAttendanceReport(filters);
    })
  );

function toCsv(records: Array<Record<string, unknown>>): string {
  const escape = (value: unknown) => {
    const s = value == null ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = [
    'date',
    'employee',
    'department',
    'shift',
    'check_in',
    'check_out',
    'late_minutes',
    'status'
  ];
  const lines = records.map((r) =>
    [r.date, r.employee, r.department, r.shift, r.check_in, r.check_out, r.late_minutes, r.status]
      .map(escape)
      .join(',')
  );
  return [headers.join(','), ...lines].join('\n');
}

export const exportAttendanceReportFn = createServerFn({ method: 'POST' })
  .validator(exportReportSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      await requirePermission('attendance', 'edit');
      const { getAdminAttendanceReport } = await import('@/lib/db/attendance');
      const { filters, format } = data;

      const result = await getAdminAttendanceReport({ ...filters, page: 1, limit: 10_000 });
      if (!result.success) return { success: false };

      const rows = result.records.map((r) => ({
        date: r.attendance.date,
        employee: r.employee?.full_name ?? r.attendance.user_id,
        department: r.department?.name ?? '',
        shift: r.shift?.name ?? '',
        check_in: r.attendance.check_in_time ?? '',
        check_out: r.attendance.check_out_time ?? '',
        late_minutes: r.attendance.late_duration ?? '',
        status: r.attendance.attendance_status
      }));

      if (format === 'csv') {
        return { success: true, format, content: toCsv(rows), mime: 'text/csv', ext: 'csv' };
      }

      if (format === 'xlsx') {
        const XLSX = await import('xlsx');
        const sheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return {
          success: true,
          format,
          content: buffer.toString('base64'),
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ext: 'xlsx'
        };
      }

      const { PDFDocument, StandardFonts } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      let page = doc.addPage([595, 842]);
      let y = 800;
      page.drawText('Attendance Report', { x: 40, y, size: 18, font });
      y -= 30;
      // Never truncate: paginate across as many pages as the rows require.
      for (const row of rows) {
        if (y < 40) {
          page = doc.addPage([595, 842]);
          y = 800;
        }
        page.drawText(
          `${row.date}  ${row.employee}  ${row.shift}  ${row.check_in}  ${row.status}`,
          { x: 40, y, size: 9, font }
        );
        y -= 14;
      }
      const pdf = await doc.save();
      return {
        success: true,
        format,
        content: Buffer.from(pdf).toString('base64'),
        mime: 'application/pdf',
        ext: 'pdf'
      };
    })
  );

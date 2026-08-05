import { and, eq, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { businessDateInTimeZone } from '@/lib/dates';
import {
  employeeShifts,
  locations,
  shifts,
  leaves,
  performanceReports,
  shiftWeekdayRules,
  scheduleAssignments,
  dateOverrides,
  dayOffs,
  attendanceCorrections,
  leaveTypeConfigs
} from './schema/attendance';
import { employees } from './schema/employees';
import { departments } from './schema/masterdata';
import type {
  AttendanceCheckInPayload,
  AttendanceCheckOutPayload,
  AttendanceFilters,
  AttendanceHistoryResponse,
  LeaveRequestPayload,
  LeaveFilters,
  LeaveListResponse,
  PerformanceStatsResponse,
  EffectiveSchedule,
  LocationPolicy,
  AttendancePolicy
} from '@/features/attendance/api/types';
import { buildPagination, buildConditions } from './utils';
import {
  resolveAttendancePolicy as resolveAttendancePolicyUtil,
  calculateLateMinutes,
  isLocationStale,
  isAccuracyAcceptable
} from '@/features/attendance/utils/schedule';

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Local calendar date (YYYY-MM-DD) — never UTC, so "today" matches the
// employee's local day rather than the server's UTC day.
function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getLocations() {
  try {
    const rows = await db.select().from(locations).where(eq(locations.status, 'active'));
    return { success: true, locations: rows };
  } catch (e) {
    mapDbError(e, 'attendance.getLocations');
  }
}

export async function getShifts() {
  try {
    const rows = await db.select().from(shifts).where(eq(shifts.status, 'active'));
    return { success: true, shifts: rows };
  } catch (e) {
    mapDbError(e, 'attendance.getShifts');
  }
}

export async function getEmployeeAttendance(userId: string, date?: string) {
  try {
    const today = date ?? businessDateInTimeZone(new Date());
    const [record] = await db
      .select({
        attendance: employeeShifts,
        shift: shifts,
        location: locations
      })
      .from(employeeShifts)
      .leftJoin(shifts, eq(employeeShifts.shift_id, shifts.id))
      .leftJoin(locations, eq(employeeShifts.lock_location, locations.id))
      .where(and(eq(employeeShifts.user_id, userId), eq(employeeShifts.date, today)))
      .limit(1);

    return {
      success: true,
      attendance: record ?? null
    };
  } catch (e) {
    mapDbError(e, 'attendance.getEmployeeAttendance');
  }
}

export async function getAttendanceHistory(
  userId: string,
  filters: AttendanceFilters
): Promise<AttendanceHistoryResponse> {
  try {
    const { limit, offset } = buildPagination(filters);

    const where = buildConditions([
      eq(employeeShifts.user_id, userId),
      filters.month && filters.year
        ? gte(employeeShifts.date, `${filters.year}-${String(filters.month).padStart(2, '0')}-01`)
        : undefined,
      filters.month && filters.year
        ? lte(employeeShifts.date, `${filters.year}-${String(filters.month).padStart(2, '0')}-31`)
        : undefined,
      filters.status ? eq(employeeShifts.attendance_status, filters.status) : undefined
    ]);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          attendance: employeeShifts,
          shift: shifts,
          location: locations
        })
        .from(employeeShifts)
        .leftJoin(shifts, eq(employeeShifts.shift_id, shifts.id))
        .leftJoin(locations, eq(employeeShifts.lock_location, locations.id))
        .where(where)
        .orderBy(desc(employeeShifts.date))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(employeeShifts)
        .where(where)
    ]);

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Attendance history fetched',
      total: count,
      offset,
      limit,
      records: rows
    };
  } catch (e) {
    mapDbError(e, 'attendance.getAttendanceHistory');
  }
}

export async function checkIn(userId: string, payload: AttendanceCheckInPayload) {
  try {
    const today = localDateString();
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM

    // Resolve effective schedule
    const effectiveSchedule = await getEffectiveEmployeeSchedule(userId, today);
    if (!effectiveSchedule) {
      return {
        success: false,
        code: 'NO_SCHEDULE',
        message: 'No active schedule found for today'
      };
    }

    // Resolve attendance policy
    const policy = await getAttendancePolicy(payload.locationId ?? null, effectiveSchedule.shiftId);

    let distanceToOffice: number | null = null;

    // Check GPS validation
    if (policy.gpsValidationEnabled) {
      // When GPS validation is enabled every coordinate field is required;
      // omitting any of them must not bypass validation.
      if (
        payload.latitude == null ||
        payload.longitude == null ||
        payload.accuracy == null ||
        payload.capturedAt == null ||
        payload.locationId == null
      ) {
        return {
          success: false,
          code: 'GPS_REQUIRED',
          message: 'GPS location is required'
        };
      }
      // Reject stale coordinates (server-side, never trust the client)
      if (isLocationStale(payload.capturedAt, Date.now(), policy.maxStaleMs)) {
        return {
          success: false,
          code: 'GPS_STALE',
          message: 'Location is stale. Refresh your location and try again.'
        };
      }
      // Reject inaccurate coordinates
      if (!isAccuracyAcceptable(payload.accuracy, policy.maxAccuracyMeters)) {
        return {
          success: false,
          code: 'GPS_INACCURATE',
          message: 'GPS accuracy is too low. Move to an open area and refresh.'
        };
      }
      // Validate geofence against the submitted location
      const [location] = await db
        .select()
        .from(locations)
        .where(eq(locations.id, payload.locationId))
        .limit(1);

      if (!location || location.latitude == null || location.longitude == null) {
        return {
          success: false,
          code: 'GPS_REQUIRED',
          message: 'Location not found'
        };
      }

      distanceToOffice = calculateDistance(
        payload.latitude,
        payload.longitude,
        location.latitude,
        location.longitude
      );

      if (location.radius != null && distanceToOffice > location.radius) {
        return {
          success: false,
          code: 'OUTSIDE_RADIUS',
          message: `You are ${Math.round(distanceToOffice)}m from the office. Must be within ${location.radius}m.`
        };
      }
    }

    // Selfie requirement
    if (policy.selfieRequired && !payload.photo) {
      return {
        success: false,
        code: 'SELFIE_REQUIRED',
        message: 'A selfie photo is required to check in'
      };
    }

    // Calculate late minutes
    const lateMinutes = calculateLateMinutes({
      schedule: effectiveSchedule,
      actualCheckIn: nowTime
    });

    const attendanceStatus = lateMinutes > 0 ? 'late' : 'present';

    const [record] = await db
      .insert(employeeShifts)
      .values({
        user_id: userId,
        shift_id: effectiveSchedule.shiftId,
        date: today,
        check_in_time: now,
        late_duration: lateMinutes > 0 ? lateMinutes : null,
        check_in_latitude: payload.latitude ?? null,
        check_in_longitude: payload.longitude ?? null,
        check_in_accuracy: payload.accuracy ?? null,
        check_in_timestamp: payload.capturedAt != null ? new Date(payload.capturedAt) : null,
        distance_to_office_in: distanceToOffice,
        check_in_photo: payload.photo ?? null,
        check_in_note: payload.note ?? null,
        gps_validation_enabled: policy.gpsValidationEnabled,
        selfie_required: policy.selfieRequired,
        validation_state: policy.gpsValidationEnabled ? 'valid' : 'disabled',
        lock_location: payload.locationId ?? null,
        attendance_status: attendanceStatus
      })
      .returning();

    return {
      success: true,
      message: 'Check-in successful',
      attendance: record
    };
  } catch (e) {
    mapDbError(e, 'attendance.checkIn');
  }
}

export async function checkOut(userId: string, payload: AttendanceCheckOutPayload) {
  try {
    const today = localDateString();
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    const [existing] = await db
      .select()
      .from(employeeShifts)
      .where(
        and(
          eq(employeeShifts.user_id, userId),
          eq(employeeShifts.date, today),
          eq(employeeShifts.id, payload.attendanceId)
        )
      )
      .limit(1);

    if (!existing) {
      return {
        success: false,
        code: 'NO_CHECK_IN',
        message: 'No check-in record found for today'
      };
    }

    if (existing.check_out_time) {
      return {
        success: false,
        code: 'ALREADY_CHECKED_OUT',
        message: 'Already checked out today'
      };
    }

    let distanceToOffice: number | null = null;
    if (existing.gps_validation_enabled) {
      // Check-out is validated against the policy the check-in was locked to;
      // omitting any coordinate field must not bypass validation.
      if (
        payload.latitude == null ||
        payload.longitude == null ||
        payload.accuracy == null ||
        payload.capturedAt == null ||
        existing.lock_location == null
      ) {
        return {
          success: false,
          code: 'GPS_REQUIRED',
          message: 'GPS location is required'
        };
      }
      const policy = await getAttendancePolicy(existing.lock_location, existing.shift_id);
      if (isLocationStale(payload.capturedAt, Date.now(), policy.maxStaleMs)) {
        return {
          success: false,
          code: 'GPS_STALE',
          message: 'Location is stale. Refresh your location and try again.'
        };
      }
      if (!isAccuracyAcceptable(payload.accuracy, policy.maxAccuracyMeters)) {
        return {
          success: false,
          code: 'GPS_INACCURATE',
          message: 'GPS accuracy is too low. Move to an open area and refresh.'
        };
      }
      const [location] = await db
        .select()
        .from(locations)
        .where(eq(locations.id, existing.lock_location))
        .limit(1);

      if (!location || location.latitude == null || location.longitude == null) {
        return {
          success: false,
          code: 'GPS_REQUIRED',
          message: 'Location not found'
        };
      }

      distanceToOffice = calculateDistance(
        payload.latitude,
        payload.longitude,
        location.latitude,
        location.longitude
      );

      if (location.radius != null && distanceToOffice > location.radius) {
        return {
          success: false,
          code: 'OUTSIDE_RADIUS',
          message: `You are ${Math.round(distanceToOffice)}m from the office. Must be within ${location.radius}m.`
        };
      }
    }

    if (existing.selfie_required && !payload.photo) {
      return {
        success: false,
        code: 'SELFIE_REQUIRED',
        message: 'A selfie photo is required to check out'
      };
    }

    const [record] = await db
      .update(employeeShifts)
      .set({
        check_out_time: now,
        early_out_duration: payload.earlyOutDuration ?? null,
        check_out_latitude: payload.latitude ?? null,
        check_out_longitude: payload.longitude ?? null,
        check_out_accuracy: payload.accuracy ?? null,
        check_out_timestamp: payload.capturedAt != null ? new Date(payload.capturedAt) : null,
        distance_to_office_out: distanceToOffice,
        check_out_photo: payload.photo ?? null,
        check_out_note: payload.note ?? null,
        updated_at: new Date()
      })
      .where(eq(employeeShifts.id, payload.attendanceId))
      .returning();

    return {
      success: true,
      message: 'Check-out successful',
      attendance: record
    };
  } catch (e) {
    mapDbError(e, 'attendance.checkOut');
  }
}

export async function createLeaveRequest(userId: string, payload: LeaveRequestPayload) {
  try {
    // Enforce leave-type attachment policy on the server, not just the form.
    const [config] = await db
      .select()
      .from(leaveTypeConfigs)
      .where(eq(leaveTypeConfigs.leave_type, payload.leaveType))
      .limit(1);
    if (config?.attachment_required && !payload.file) {
      return {
        success: false,
        message: 'An attachment is required for this leave type'
      };
    }

    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const [leave] = await db
      .insert(leaves)
      .values({
        user_id: userId,
        start_date: payload.startDate,
        end_date: payload.endDate,
        total_days: totalDays,
        leave_type: payload.leaveType,
        reason: payload.reason ?? null,
        request_file: payload.file ?? null,
        status: 'pending'
      })
      .returning();

    return {
      success: true,
      message: 'Leave request submitted',
      leave
    };
  } catch (e) {
    mapDbError(e, 'attendance.createLeaveRequest');
  }
}

export async function getMyLeaves(
  userId: string,
  filters: LeaveFilters
): Promise<LeaveListResponse> {
  try {
    const { limit, offset } = buildPagination(filters);

    const where = buildConditions([
      eq(leaves.user_id, userId),
      filters.status ? eq(leaves.status, filters.status) : undefined,
      filters.leaveType ? eq(leaves.leave_type, filters.leaveType) : undefined
    ]);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(leaves)
        .where(where)
        .orderBy(desc(leaves.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(leaves)
        .where(where)
    ]);

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Leaves fetched',
      total: count,
      offset,
      limit,
      leaves: rows
    };
  } catch (e) {
    mapDbError(e, 'attendance.getMyLeaves');
  }
}

export async function getPerformanceStats(userId: string): Promise<PerformanceStatsResponse> {
  try {
    const rows = await db
      .select()
      .from(performanceReports)
      .where(eq(performanceReports.user_id, userId))
      .orderBy(asc(performanceReports.date));

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Performance stats fetched',
      reports: rows
    };
  } catch (e) {
    mapDbError(e, 'attendance.getPerformanceStats');
  }
}

export async function getAttendanceSummary(userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const rows = await db
      .select()
      .from(employeeShifts)
      .where(
        and(
          eq(employeeShifts.user_id, userId),
          sql`${employeeShifts.date} LIKE ${currentMonth + '%'}`
        )
      );

    const present = rows.filter(
      (r) => r.attendance_status === 'present' || r.attendance_status === 'late'
    ).length;
    const late = rows.filter((r) => r.attendance_status === 'late').length;
    const absent = rows.filter((r) => r.attendance_status === 'absent').length;

    return {
      success: true,
      summary: {
        total: rows.length,
        present,
        late,
        absent,
        month: currentMonth
      }
    };
  } catch (e) {
    mapDbError(e, 'attendance.getAttendanceSummary');
  }
}

// --- Schedule resolution ---

export async function getEffectiveEmployeeSchedule(
  userId: string,
  date: string
): Promise<EffectiveSchedule | null> {
  try {
    // Get user's schedule assignment
    const [assignment] = await db
      .select()
      .from(scheduleAssignments)
      .where(
        and(
          eq(scheduleAssignments.user_id, userId),
          sql`${scheduleAssignments.effective_from} <= ${date}`,
          sql`(${scheduleAssignments.effective_to} IS NULL OR ${scheduleAssignments.effective_to} >= ${date})`
        )
      )
      .orderBy(desc(scheduleAssignments.effective_from))
      .limit(1);

    if (!assignment) return null;

    // Check day offs first (takes precedence over everything)
    const dayOff = await db
      .select()
      .from(dayOffs)
      .where(and(eq(dayOffs.user_id, userId), eq(dayOffs.date, date)))
      .limit(1);

    if (dayOff.length > 0) return null;

    // Check date overrides (shift substitution for this date)
    const [override] = await db
      .select()
      .from(dateOverrides)
      .where(and(eq(dateOverrides.user_id, userId), eq(dateOverrides.date, date)))
      .limit(1);

    const effectiveShiftId = override ? override.shift_id : assignment.shift_id;

    // Get weekday rules for the EFFECTIVE shift (post-override)
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const [rule] = await db
      .select()
      .from(shiftWeekdayRules)
      .where(
        and(
          eq(shiftWeekdayRules.shift_id, effectiveShiftId),
          eq(shiftWeekdayRules.day_of_week, dayOfWeek)
        )
      )
      .limit(1);

    if (!rule || !rule.is_working_day) return null;

    return {
      shiftId: effectiveShiftId,
      startTime: rule.start_time!,
      endTime: rule.end_time!,
      lateToleranceMinutes: rule.late_tolerance_minutes ?? 0,
      absenceCutoffMinutes: rule.absence_cutoff_minutes ?? 120,
      isWorkingDay: true
    };
  } catch (e) {
    mapDbError(e, 'attendance.getEffectiveEmployeeSchedule');
    return null;
  }
}

export async function getAttendancePolicy(
  locationId: number | null,
  _shiftId: number | null
): Promise<AttendancePolicy> {
  try {
    let locationPolicy: LocationPolicy = {
      gpsValidationEnabled: true,
      selfieRequired: false,
      maxAccuracyMeters: 50,
      maxStaleMs: 30000
    };

    if (locationId) {
      const [location] = await db
        .select()
        .from(locations)
        .where(eq(locations.id, locationId))
        .limit(1);

      if (location) {
        locationPolicy = {
          gpsValidationEnabled: location.gps_validation_enabled ?? true,
          selfieRequired: location.selfie_required ?? false,
          maxAccuracyMeters: location.max_accuracy_meters ?? 50,
          maxStaleMs: location.max_stale_ms ?? 30000
        };
      }
    }

    // Schedule-level policy overrides are deferred (see docs/CHANGELOG.md);
    // only location-level policies apply in this release.
    const schedulePolicyOverride = null;

    return resolveAttendancePolicyUtil({
      locationPolicy,
      schedulePolicyOverride
    });
  } catch (e) {
    mapDbError(e, 'attendance.getAttendancePolicy');
    return {
      gpsValidationEnabled: true,
      selfieRequired: false,
      maxAccuracyMeters: 50,
      maxStaleMs: 30000
    };
  }
}

// --- CRUD for new tables ---

export async function getShiftWeekdayRules(shiftId: number) {
  try {
    const rows = await db
      .select()
      .from(shiftWeekdayRules)
      .where(eq(shiftWeekdayRules.shift_id, shiftId));
    return { success: true, rules: rows };
  } catch (e) {
    mapDbError(e, 'attendance.getShiftWeekdayRules');
    return { success: false, rules: [] };
  }
}

export async function createScheduleAssignment(input: {
  userId: string;
  shiftId: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdBy?: string;
}) {
  try {
    const [record] = await db
      .insert(scheduleAssignments)
      .values({
        user_id: input.userId,
        shift_id: input.shiftId,
        effective_from: input.effectiveFrom,
        effective_to: input.effectiveTo ?? null,
        created_by: input.createdBy ?? null
      })
      .returning();
    return { success: true, assignment: record };
  } catch (e) {
    mapDbError(e, 'attendance.createScheduleAssignment');
    return { success: false };
  }
}

export async function createDayOff(input: {
  userId: string;
  date: string;
  reason?: string;
  createdBy?: string;
}) {
  try {
    const [record] = await db
      .insert(dayOffs)
      .values({
        user_id: input.userId,
        date: input.date,
        reason: input.reason ?? null,
        created_by: input.createdBy ?? null
      })
      .returning();
    return { success: true, dayOff: record };
  } catch (e) {
    mapDbError(e, 'attendance.createDayOff');
    return { success: false };
  }
}

export async function createAttendanceCorrection(input: {
  attendanceId: number;
  actorId: string;
  reason: string;
  previousValues?: string;
  newValues?: string;
}) {
  try {
    const [record] = await db
      .insert(attendanceCorrections)
      .values({
        attendance_id: input.attendanceId,
        actor_id: input.actorId,
        reason: input.reason,
        previous_values: input.previousValues ?? null,
        new_values: input.newValues ?? null
      })
      .returning();
    return { success: true, correction: record };
  } catch (e) {
    mapDbError(e, 'attendance.createAttendanceCorrection');
    return { success: false };
  }
}

// --- Location CRUD ---

export async function createLocation(input: {
  name: string;
  description?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  gpsValidationEnabled?: boolean;
  selfieRequired?: boolean;
  maxAccuracyMeters?: number;
  maxStaleMs?: number;
  createdBy?: string;
}) {
  try {
    const [record] = await db
      .insert(locations)
      .values({
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'active',
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        radius: input.radius ?? 100,
        gps_validation_enabled: input.gpsValidationEnabled ?? true,
        selfie_required: input.selfieRequired ?? false,
        max_accuracy_meters: input.maxAccuracyMeters ?? 50,
        max_stale_ms: input.maxStaleMs ?? 30000,
        created_by: input.createdBy ?? null
      })
      .returning();
    return { success: true, location: record };
  } catch (e) {
    mapDbError(e, 'attendance.createLocation');
    return { success: false };
  }
}

export async function updateLocation(id: number, input: Record<string, unknown>, actorId: string) {
  try {
    const [record] = await db
      .update(locations)
      .set({ ...input, updated_at: new Date() })
      .where(eq(locations.id, id))
      .returning();
    if (!record) return { success: false, message: 'Location not found' };
    return { success: true, location: record, actorId };
  } catch (e) {
    mapDbError(e, 'attendance.updateLocation');
    return { success: false };
  }
}

export async function deleteLocation(id: number) {
  try {
    await db.delete(locations).where(eq(locations.id, id));
    return { success: true };
  } catch (e) {
    mapDbError(e, 'attendance.deleteLocation');
    return { success: false };
  }
}

// --- Schedule CRUD ---

export async function createSchedule(input: {
  name: string;
  startTime: string;
  endTime: string;
  type?: string;
  weekdayRules?: Array<{
    dayOfWeek: number;
    isWorkingDay?: boolean;
    startTime?: string | null;
    endTime?: string | null;
    lateToleranceMinutes?: number;
    absenceCutoffMinutes?: number;
  }>;
}) {
  try {
    const [shift] = await db
      .insert(shifts)
      .values({
        name: input.name,
        start_time: input.startTime,
        end_time: input.endTime,
        type: (input.type ?? 'fixed') as 'fixed' | 'flexible'
      })
      .returning();

    if (input.weekdayRules && input.weekdayRules.length > 0) {
      await db.insert(shiftWeekdayRules).values(
        input.weekdayRules.map((r) => ({
          shift_id: shift.id,
          day_of_week: r.dayOfWeek,
          is_working_day: r.isWorkingDay ?? true,
          start_time: r.startTime ?? input.startTime,
          end_time: r.endTime ?? input.endTime,
          late_tolerance_minutes: r.lateToleranceMinutes ?? 0,
          absence_cutoff_minutes: r.absenceCutoffMinutes ?? 120
        }))
      );
    }

    return { success: true, shift };
  } catch (e) {
    mapDbError(e, 'attendance.createSchedule');
    return { success: false };
  }
}

export async function updateSchedule(
  id: number,
  input: {
    name?: string;
    startTime?: string;
    endTime?: string;
    type?: string;
    weekdayRules?: Array<{
      dayOfWeek: number;
      isWorkingDay?: boolean;
      startTime?: string | null;
      endTime?: string | null;
      lateToleranceMinutes?: number;
      absenceCutoffMinutes?: number;
    }>;
  }
) {
  try {
    const patch: Record<string, unknown> = {};
    if (input.name) patch.name = input.name;
    if (input.startTime) patch.start_time = input.startTime;
    if (input.endTime) patch.end_time = input.endTime;
    if (input.type) patch.type = input.type;

    if (Object.keys(patch).length > 0) {
      await db
        .update(shifts)
        .set({ ...patch, updated_at: new Date() })
        .where(eq(shifts.id, id));
    }

    if (input.weekdayRules) {
      await db.delete(shiftWeekdayRules).where(eq(shiftWeekdayRules.shift_id, id));
      if (input.weekdayRules.length > 0) {
        await db.insert(shiftWeekdayRules).values(
          input.weekdayRules.map((r) => ({
            shift_id: id,
            day_of_week: r.dayOfWeek,
            is_working_day: r.isWorkingDay ?? true,
            start_time: r.startTime ?? input.startTime ?? null,
            end_time: r.endTime ?? input.endTime ?? null,
            late_tolerance_minutes: r.lateToleranceMinutes ?? 0,
            absence_cutoff_minutes: r.absenceCutoffMinutes ?? 120
          }))
        );
      }
    }

    return { success: true };
  } catch (e) {
    mapDbError(e, 'attendance.updateSchedule');
    return { success: false };
  }
}

export async function listScheduleAssignments(filters: {
  page?: number;
  limit?: number;
  userId?: string;
  shiftId?: number;
}) {
  try {
    const { limit, offset } = buildPagination(filters);
    const where = buildConditions([
      filters.userId ? eq(scheduleAssignments.user_id, filters.userId) : undefined,
      filters.shiftId ? eq(scheduleAssignments.shift_id, filters.shiftId) : undefined
    ]);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          assignment: scheduleAssignments,
          shift: shifts
        })
        .from(scheduleAssignments)
        .leftJoin(shifts, eq(scheduleAssignments.shift_id, shifts.id))
        .where(where)
        .orderBy(desc(scheduleAssignments.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(scheduleAssignments)
        .where(where)
    ]);

    return { success: true, total: count, offset, limit, records: rows };
  } catch (e) {
    mapDbError(e, 'attendance.listScheduleAssignments');
    return { success: false, total: 0, offset: 0, limit: 0, records: [] };
  }
}

export async function bulkAssignSchedule(
  entries: Array<{
    userId: string;
    shiftId: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }>,
  actorId: string
) {
  try {
    const created = await db.transaction(async (tx) => {
      const inserted = [];
      for (const entry of entries) {
        const [row] = await tx
          .insert(scheduleAssignments)
          .values({
            user_id: entry.userId,
            shift_id: entry.shiftId,
            effective_from: entry.effectiveFrom,
            effective_to: entry.effectiveTo ?? null,
            created_by: actorId
          })
          .returning();
        inserted.push(row);
      }
      return inserted;
    });
    return { success: true, count: created.length, assignments: created };
  } catch (e) {
    mapDbError(e, 'attendance.bulkAssignSchedule');
    return { success: false };
  }
}

export async function deleteDayOff(id: number) {
  try {
    await db.delete(dayOffs).where(eq(dayOffs.id, id));
    return { success: true };
  } catch (e) {
    mapDbError(e, 'attendance.deleteDayOff');
    return { success: false };
  }
}

// --- Corrections ---

export async function requestAttendanceCorrection(
  userId: string,
  input: {
    attendanceId: number;
    requestedCheckInTime?: string;
    requestedCheckOutTime?: string;
    note?: string;
  }
) {
  try {
    const [existing] = await db
      .select()
      .from(employeeShifts)
      .where(and(eq(employeeShifts.id, input.attendanceId), eq(employeeShifts.user_id, userId)))
      .limit(1);
    if (!existing) return { success: false, message: 'Attendance record not found' };

    const [record] = await db
      .update(employeeShifts)
      .set({
        requested_check_in_time: input.requestedCheckInTime ?? existing.requested_check_in_time,
        requested_check_out_time: input.requestedCheckOutTime ?? existing.requested_check_out_time,
        request_note: input.note ?? existing.request_note,
        request_status: 'pending',
        request_file: existing.request_file
      })
      .where(eq(employeeShifts.id, input.attendanceId))
      .returning();
    return { success: true, attendance: record };
  } catch (e) {
    mapDbError(e, 'attendance.requestAttendanceCorrection');
    return { success: false };
  }
}

export async function reviewAttendanceCorrection(
  actorId: string,
  input: { attendanceId: number; decision: 'approve' | 'reject'; reason: string }
) {
  try {
    const [existing] = await db
      .select()
      .from(employeeShifts)
      .where(eq(employeeShifts.id, input.attendanceId))
      .limit(1);
    if (!existing) return { success: false, message: 'Attendance record not found' };

    const approved = input.decision === 'approve';
    const patch: Record<string, unknown> = {
      request_status: approved ? 'approved' : 'rejected',
      approved_by: actorId,
      comment: input.reason,
      updated_at: new Date()
    };
    if (approved) {
      if (existing.requested_check_in_time) patch.check_in_time = existing.requested_check_in_time;
      if (existing.requested_check_out_time)
        patch.check_out_time = existing.requested_check_out_time;
    }

    const record = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(employeeShifts)
        .set(patch)
        .where(eq(employeeShifts.id, input.attendanceId))
        .returning();

      await tx.insert(attendanceCorrections).values({
        attendance_id: input.attendanceId,
        actor_id: actorId,
        reason: input.reason,
        previous_values: JSON.stringify({
          check_in_time: existing.check_in_time,
          check_out_time: existing.check_out_time,
          request_status: existing.request_status
        }),
        new_values: JSON.stringify({
          check_in_time: updated.check_in_time,
          check_out_time: updated.check_out_time,
          request_status: updated.request_status
        })
      });

      return updated;
    });

    return { success: true, attendance: record };
  } catch (e) {
    mapDbError(e, 'attendance.reviewAttendanceCorrection');
    return { success: false };
  }
}

// --- Admin reports ---

export type AdminReportFilters = {
  page?: number;
  limit?: number;
  userId?: string;
  departmentId?: number;
  locationId?: number;
  shiftId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
};

export async function getAdminAttendanceReport(filters: AdminReportFilters = {}) {
  try {
    const { limit, offset } = buildPagination(filters);

    const where = and(
      filters.userId ? eq(employeeShifts.user_id, filters.userId) : undefined,
      filters.status ? eq(employeeShifts.attendance_status, filters.status) : undefined,
      filters.startDate ? gte(employeeShifts.date, filters.startDate) : undefined,
      filters.endDate ? lte(employeeShifts.date, filters.endDate) : undefined,
      filters.shiftId ? eq(employeeShifts.shift_id, filters.shiftId) : undefined,
      filters.locationId ? eq(employeeShifts.lock_location, filters.locationId) : undefined
    );

    const records = await db
      .select({
        attendance: employeeShifts,
        shift: shifts,
        location: locations,
        employee: employees,
        department: departments
      })
      .from(employeeShifts)
      .leftJoin(shifts, eq(employeeShifts.shift_id, shifts.id))
      .leftJoin(locations, eq(employeeShifts.lock_location, locations.id))
      .leftJoin(employees, eq(employeeShifts.user_id, employees.id))
      .leftJoin(departments, eq(employees.department_id, departments.id))
      .where(
        and(
          where,
          filters.departmentId ? eq(employees.department_id, filters.departmentId) : undefined
        )
      )
      .orderBy(desc(employeeShifts.date))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeShifts)
      .leftJoin(employees, eq(employeeShifts.user_id, employees.id))
      .where(
        and(
          where,
          filters.departmentId ? eq(employees.department_id, filters.departmentId) : undefined
        )
      );

    return {
      success: true,
      total: countRow?.count ?? 0,
      offset,
      limit,
      records
    };
  } catch (e) {
    mapDbError(e, 'attendance.getAdminAttendanceReport');
    return { success: false, total: 0, offset: 0, limit: 0, records: [] };
  }
}

export type AdminAttendanceReportRow = Awaited<
  ReturnType<typeof getAdminAttendanceReport>
>['records'][number];

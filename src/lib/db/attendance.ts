import { and, eq, gte, lte, sql, desc, asc, inArray } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
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
  attendanceCorrections
} from './schema/attendance';
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
  WeekdayScheduleRule,
  ScheduleAssignment,
  DateOverride,
  LocationPolicy,
  AttendancePolicy
} from '@/features/attendance/api/types';
import { buildPagination, buildConditions } from './utils';
import {
  resolveEffectiveSchedule as resolveEffectiveScheduleUtil,
  resolveAttendancePolicy as resolveAttendancePolicyUtil,
  calculateLateMinutes,
  isLocationStale,
  isAccuracyAcceptable
} from '@/features/attendance/utils/schedule';

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
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
    const today = date ?? new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM

    // Resolve effective schedule
    const effectiveSchedule = await getEffectiveEmployeeSchedule(userId, today);
    if (!effectiveSchedule) {
      return {
        success: false,
        message: 'No active schedule found for today'
      };
    }

    // Resolve attendance policy
    const policy = await getAttendancePolicy(payload.locationId ?? null, effectiveSchedule.shiftId);

    let distanceToOffice: number | null = null;

    // Check GPS validation
    if (policy.gpsValidationEnabled) {
      if (payload.latitude == null || payload.longitude == null) {
        return {
          success: false,
          message: 'GPS location is required'
        };
      }
      // Validate geofence
      if (payload.locationId) {
        const [location] = await db
          .select()
          .from(locations)
          .where(eq(locations.id, payload.locationId))
          .limit(1);

        if (location && location.latitude != null && location.longitude != null) {
          distanceToOffice = calculateDistance(
            payload.latitude,
            payload.longitude,
            location.latitude,
            location.longitude
          );

          if (location.radius != null && distanceToOffice > location.radius) {
            return {
              success: false,
              message: `You are ${Math.round(distanceToOffice)}m from the office. Must be within ${location.radius}m.`
            };
          }
        }
      }
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
        check_in_accuracy: null, // Will be set by the API layer
        check_in_timestamp: null, // Will be set by the API layer
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
    const today = new Date().toISOString().split('T')[0];
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
        message: 'No check-in record found for today'
      };
    }

    if (existing.check_out_time) {
      return {
        success: false,
        message: 'Already checked out today'
      };
    }

    let distanceToOffice: number | null = null;
    if (payload.latitude != null && payload.longitude != null && existing.lock_location) {
      const [location] = await db
        .select()
        .from(locations)
        .where(eq(locations.id, existing.lock_location))
        .limit(1);

      if (location && location.latitude != null && location.longitude != null) {
        distanceToOffice = calculateDistance(
          payload.latitude,
          payload.longitude,
          location.latitude,
          location.longitude
        );
      }
    }

    const [record] = await db
      .update(employeeShifts)
      .set({
        check_out_time: now,
        early_out_duration: payload.earlyOutDuration ?? null,
        check_out_latitude: payload.latitude ?? null,
        check_out_longitude: payload.longitude ?? null,
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
  shiftId: number | null
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

    // Schedule policy override not implemented yet (would need schedule-level policy)
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

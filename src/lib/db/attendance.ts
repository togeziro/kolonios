import { and, eq, or, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
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
  leaveTypeConfigs,
  nationalHolidays
} from './schema/attendance';
import { employees } from './schema/employees';
import { departments } from './schema/masterdata';
import { dailyChecklists } from './schema/checklists';
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
} from '@/lib/domain/attendance';
import { buildPagination, buildConditions } from './utils';
import {
  resolveAttendancePolicy as resolveAttendancePolicyUtil,
  calculateLateMinutes,
  isLocationStale,
  isAccuracyAcceptable
} from '@/lib/attendance/schedule';

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

export type GpsValidationInput = {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: number;
  locationId?: number | null;
  policy: AttendancePolicy;
};

export type GpsValidationResult =
  | { ok: true; distanceToOffice: number }
  | { ok: false; code: string; message: string };

export async function validateGpsLocation(input: GpsValidationInput): Promise<GpsValidationResult> {
  const { latitude, longitude, accuracy, capturedAt, locationId, policy } = input;
  // When GPS validation is enabled every coordinate field is required;
  // omitting any of them must not bypass validation.
  if (
    latitude == null ||
    longitude == null ||
    accuracy == null ||
    capturedAt == null ||
    locationId == null
  ) {
    return { ok: false, code: 'GPS_REQUIRED', message: 'GPS location is required' };
  }
  // Reject stale coordinates (server-side, never trust the client)
  if (isLocationStale(capturedAt, Date.now(), policy.maxStaleMs)) {
    return {
      ok: false,
      code: 'GPS_STALE',
      message: 'Location is stale. Refresh your location and try again.'
    };
  }
  // Reject inaccurate coordinates
  if (!isAccuracyAcceptable(accuracy, policy.maxAccuracyMeters)) {
    return {
      ok: false,
      code: 'GPS_INACCURATE',
      message: 'GPS accuracy is too low. Move to an open area and refresh.'
    };
  }
  // Validate geofence against the submitted location
  const [location] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);

  if (!location || location.latitude == null || location.longitude == null) {
    return { ok: false, code: 'GPS_REQUIRED', message: 'Location not found' };
  }

  const distanceToOffice = calculateDistance(
    latitude,
    longitude,
    location.latitude,
    location.longitude
  );

  if (location.radius != null && distanceToOffice > location.radius) {
    return {
      ok: false,
      code: 'OUTSIDE_RADIUS',
      message: `You are ${Math.round(distanceToOffice)}m from the office. Must be within ${location.radius}m.`
    };
  }

  return { ok: true, distanceToOffice };
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
    const today = businessDateInTimeZone(new Date());
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
      const gps = await validateGpsLocation({ ...payload, policy });
      if (!gps.ok) {
        return {
          success: false,
          code: gps.code,
          message: gps.message
        };
      }
      distanceToOffice = gps.distanceToOffice;
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
    const today = businessDateInTimeZone(new Date());
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
      const policy = await getAttendancePolicy(existing.lock_location, existing.shift_id);
      const gps = await validateGpsLocation({
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        capturedAt: payload.capturedAt,
        locationId: existing.lock_location,
        policy
      });
      if (!gps.ok) {
        return {
          success: false,
          code: gps.code,
          message: gps.message
        };
      }
      distanceToOffice = gps.distanceToOffice;
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

    // Shift-wide policy (ADR-0004) + weekday rule for the effective shift, in one round-trip.
    // The shift's tolerance belongs to the SHIFT (not the weekday rule), so we read it from
    // `shifts` separately. If a future override targets a different shiftId mid-month, the
    // caller must pass that shift's policy via `shiftPolicies` (see getMonthlyScheduleData).
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();

    const [shiftRows, ruleRows] = await Promise.all([
      db
        .select({
          lateToleranceMinutes: shifts.late_tolerance_minutes,
          absenceCutoffMinutes: shifts.absence_cutoff_minutes
        })
        .from(shifts)
        .where(eq(shifts.id, effectiveShiftId))
        .limit(1),
      db
        .select()
        .from(shiftWeekdayRules)
        .where(
          and(
            eq(shiftWeekdayRules.shift_id, effectiveShiftId),
            eq(shiftWeekdayRules.day_of_week, dayOfWeek)
          )
        )
        .limit(1)
    ]);
    const shiftRow = shiftRows[0];
    const rule = ruleRows[0];
    if (!shiftRow || !rule || !rule.is_working_day) return null;

    return {
      shiftId: effectiveShiftId,
      startTime: rule.start_time!,
      endTime: rule.end_time!,
      lateToleranceMinutes: shiftRow.lateToleranceMinutes,
      absenceCutoffMinutes: shiftRow.absenceCutoffMinutes,
      isWorkingDay: true
    };
  } catch (e) {
    mapDbError(e, 'attendance.getEffectiveEmployeeSchedule');
    return null;
  }
}

export type ScheduleWeekdayRuleRow = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
};

export type ScheduleMonthData = {
  assignment: {
    shiftId: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    shiftName: string | null;
  } | null;
  weekdayRules: ScheduleWeekdayRuleRow[];
  shiftPolicies: { shiftId: number; lateToleranceMinutes: number; absenceCutoffMinutes: number }[];
  overrides: { date: string; shiftId: number }[];
  dayOffs: string[];
  holidays: { date: string; name: string; isRecurring: boolean }[];
};

/**
 * Range scan over `national_holidays` matching both:
 *  - non-recurring holidays with `date` in [start, end]
 *  - recurring holidays whose MM is in either `start`'s month or `end`'s
 *    month (covers a 7-day grid that may straddle two months while keeping
 *    the single-month semantics used by `getMonthlyScheduleData`)
 *
 * Used by `getMonthlyScheduleData` (My Schedule) and the admin schedule
 * grid (`getScheduleGridFn`). Extracted from the inline OR clause so both
 * callers share one definition of "what overlaps".
 */
export async function getHolidaysInRange(
  start: string,
  end: string
): Promise<{ date: string; name: string; isRecurring: boolean }[]> {
  try {
    const rows = await db
      .select({
        date: nationalHolidays.date,
        name: nationalHolidays.name,
        isRecurring: nationalHolidays.is_recurring
      })
      .from(nationalHolidays)
      .where(
        or(
          and(gte(nationalHolidays.date, start), lte(nationalHolidays.date, end)),
          and(
            eq(nationalHolidays.is_recurring, true),
            sql`substr(${nationalHolidays.date}, 6, 2) IN (substr(${start}, 6, 2), substr(${end}, 6, 2))`
          )
        )
      );
    return rows.map((r) => ({
      date: r.date,
      name: r.name,
      isRecurring: r.isRecurring ?? false
    }));
  } catch (e) {
    mapDbError(e, 'attendance.getHolidaysInRange');
    return [];
  }
}

export async function getMonthlyScheduleData(
  userId: string,
  month: string
): Promise<ScheduleMonthData> {
  const monthStart = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

  const [assignmentRows, overrides] = await Promise.all([
    db
      .select({
        shiftId: scheduleAssignments.shift_id,
        effectiveFrom: scheduleAssignments.effective_from,
        effectiveTo: scheduleAssignments.effective_to,
        shiftName: shifts.name
      })
      .from(scheduleAssignments)
      .leftJoin(shifts, eq(scheduleAssignments.shift_id, shifts.id))
      .where(
        and(
          eq(scheduleAssignments.user_id, userId),
          sql`${scheduleAssignments.effective_from} <= ${monthEnd}`,
          sql`(${scheduleAssignments.effective_to} IS NULL OR ${scheduleAssignments.effective_to} >= ${monthStart})`
        )
      )
      .orderBy(desc(scheduleAssignments.effective_from))
      .limit(1),
    db
      .select({ date: dateOverrides.date, shiftId: dateOverrides.shift_id })
      .from(dateOverrides)
      .where(
        and(
          eq(dateOverrides.user_id, userId),
          gte(dateOverrides.date, monthStart),
          lte(dateOverrides.date, monthEnd)
        )
      )
  ]);

  const assignment = assignmentRows[0];

  let weekdayRules: ScheduleWeekdayRuleRow[] = [];
  let shiftPolicies: ScheduleMonthData['shiftPolicies'] = [];
  if (assignment) {
    const result = await getShiftWeekdayRules(assignment.shiftId);
    weekdayRules = (result.success ? result.rules : []).map((r) => ({
      dayOfWeek: r.day_of_week,
      isWorkingDay: r.is_working_day ?? true,
      startTime: r.start_time,
      endTime: r.end_time
    }));

    // Shift-wide policy (ADR-0004): resolve from the assignment's shift row
    // plus every override shift referenced this month — the engine picks per-date
    // via shiftPolicies keyed by shiftId. Reuses the `overrides` fetch above.
    const policyShiftIds = new Set<number>([assignment.shiftId]);
    for (const o of overrides) policyShiftIds.add(o.shiftId);

    const policyRows = await db
      .select({
        shiftId: shifts.id,
        lateToleranceMinutes: shifts.late_tolerance_minutes,
        absenceCutoffMinutes: shifts.absence_cutoff_minutes
      })
      .from(shifts)
      .where(or(...[...policyShiftIds].map((id) => eq(shifts.id, id))));

    shiftPolicies = policyRows.map((r) => ({
      shiftId: r.shiftId,
      lateToleranceMinutes: r.lateToleranceMinutes,
      absenceCutoffMinutes: r.absenceCutoffMinutes
    }));
  }

  const dayOffRows = await db
    .select({ date: dayOffs.date })
    .from(dayOffs)
    .where(
      and(eq(dayOffs.user_id, userId), gte(dayOffs.date, monthStart), lte(dayOffs.date, monthEnd))
    );

  const holidayRows = await getHolidaysInRange(monthStart, monthEnd);

  return {
    assignment: assignment
      ? {
          shiftId: assignment.shiftId,
          effectiveFrom: assignment.effectiveFrom,
          effectiveTo: assignment.effectiveTo,
          shiftName: assignment.shiftName
        }
      : null,
    weekdayRules,
    shiftPolicies,
    overrides,
    dayOffs: dayOffRows.map((r) => r.date),
    holidays: holidayRows.map((r) => ({
      date: r.date,
      name: r.name,
      isRecurring: r.isRecurring ?? false
    }))
  };
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

export async function getShiftById(shiftId: number) {
  try {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    if (!shift) return { success: false, reason: 'not_found' as const };
    const { success: rulesSuccess, rules } = await getShiftWeekdayRules(shiftId);
    return { success: true, shift, weekdayRules: rulesSuccess ? rules : [] };
  } catch (e) {
    mapDbError(e, 'attendance.getShiftById');
    return { success: false };
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
  breakStart?: string | null;
  breakEnd?: string | null;
  maxBreakMinutes?: number | null;
  color?: string | null;
  note?: string | null;
  lateToleranceMinutes?: number;
  absenceCutoffMinutes?: number;
  status?: 'active' | 'inactive';
  weekdayRules?: Array<{
    dayOfWeek: number;
    isWorkingDay?: boolean;
    startTime?: string | null;
    endTime?: string | null;
  }>;
}) {
  try {
    const [shift] = await db
      .insert(shifts)
      .values({
        name: input.name,
        start_time: input.startTime,
        end_time: input.endTime,
        type: (input.type ?? 'fixed') as 'fixed' | 'flexible',
        break_start: input.breakStart ?? null,
        break_end: input.breakEnd ?? null,
        max_break_minutes: input.maxBreakMinutes ?? null,
        color: input.color ?? null,
        note: input.note ?? null,
        // Tolerance is shift-wide (ADR-0004); defaults match ADR's "5 and 120"
        late_tolerance_minutes: input.lateToleranceMinutes ?? 5,
        absence_cutoff_minutes: input.absenceCutoffMinutes ?? 120,
        status: input.status ?? 'active'
      })
      .returning();

    const rules =
      input.weekdayRules && input.weekdayRules.length > 0
        ? input.weekdayRules
        : // Default: Mon-Fri working, Sat-Sun off, all using shift start/end times.
          [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            dayOfWeek,
            isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
            startTime: input.startTime,
            endTime: input.endTime
          }));

    await db.insert(shiftWeekdayRules).values(
      rules.map((r) => ({
        shift_id: shift.id,
        day_of_week: r.dayOfWeek,
        is_working_day: r.isWorkingDay ?? true,
        start_time: r.startTime ?? input.startTime,
        end_time: r.endTime ?? input.endTime
      }))
    );

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
    breakStart?: string | null;
    breakEnd?: string | null;
    maxBreakMinutes?: number | null;
    color?: string | null;
    note?: string | null;
    lateToleranceMinutes?: number;
    absenceCutoffMinutes?: number;
    status?: 'active' | 'inactive';
    weekdayRules?: Array<{
      dayOfWeek: number;
      isWorkingDay?: boolean;
      startTime?: string | null;
      endTime?: string | null;
    }>;
  }
) {
  try {
    await db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.startTime !== undefined) patch.start_time = input.startTime;
      if (input.endTime !== undefined) patch.end_time = input.endTime;
      if (input.type !== undefined) patch.type = input.type;
      if (input.breakStart !== undefined) patch.break_start = input.breakStart;
      if (input.breakEnd !== undefined) patch.break_end = input.breakEnd;
      if (input.maxBreakMinutes !== undefined) patch.max_break_minutes = input.maxBreakMinutes;
      if (input.color !== undefined) patch.color = input.color;
      if (input.note !== undefined) patch.note = input.note;
      if (input.lateToleranceMinutes !== undefined)
        patch.late_tolerance_minutes = input.lateToleranceMinutes;
      if (input.absenceCutoffMinutes !== undefined)
        patch.absence_cutoff_minutes = input.absenceCutoffMinutes;
      if (input.status !== undefined) patch.status = input.status;

      if (Object.keys(patch).length > 0) {
        await tx
          .update(shifts)
          .set({ ...patch, updated_at: new Date() })
          .where(eq(shifts.id, id));
      }

      if (input.weekdayRules) {
        await tx.delete(shiftWeekdayRules).where(eq(shiftWeekdayRules.shift_id, id));
        if (input.weekdayRules.length > 0) {
          await tx.insert(shiftWeekdayRules).values(
            input.weekdayRules.map((r) => ({
              shift_id: id,
              day_of_week: r.dayOfWeek,
              is_working_day: r.isWorkingDay ?? true,
              start_time: r.startTime ?? input.startTime ?? null,
              end_time: r.endTime ?? input.endTime ?? null
            }))
          );
        }
      }
    });

    return { success: true };
  } catch (e) {
    mapDbError(e, 'attendance.updateSchedule');
    return { success: false };
  }
}

export type ShiftListItem = Awaited<ReturnType<typeof listShifts>>['shifts'][number];

export async function listShifts() {
  try {
    const rows = await db.select().from(shifts).orderBy(desc(shifts.created_at));
    if (rows.length === 0) return { success: true, shifts: [] };

    const shiftIds = rows.map((r) => r.id);

    const [assignments, employeeShiftUses, checklistUses] = await Promise.all([
      db
        .select({ shift_id: scheduleAssignments.shift_id })
        .from(scheduleAssignments)
        .where(inArray(scheduleAssignments.shift_id, shiftIds)),
      db
        .select({ shift_id: employeeShifts.shift_id })
        .from(employeeShifts)
        .where(inArray(employeeShifts.shift_id, shiftIds)),
      db
        .select({ shift_id: dailyChecklists.shift_id })
        .from(dailyChecklists)
        .where(inArray(dailyChecklists.shift_id, shiftIds))
    ]);

    const usedIds = new Set<number>();
    for (const row of [...assignments, ...employeeShiftUses, ...checklistUses]) {
      if (row.shift_id != null) usedIds.add(row.shift_id);
    }

    return {
      success: true,
      shifts: rows.map((r) => ({ ...r, used: usedIds.has(r.id) }))
    };
  } catch (e) {
    mapDbError(e, 'attendance.listShifts');
    return { success: false, shifts: [] };
  }
}

export async function deleteShift(id: number) {
  try {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
    if (!shift) {
      return { success: false, reason: 'not_found' as const };
    }

    const usedRow = await isShiftUsed(id);
    if (usedRow) {
      // Soft delete: mark inactive, preserve history.
      await db
        .update(shifts)
        .set({ status: 'inactive', updated_at: new Date() })
        .where(eq(shifts.id, id));
      return { success: true, mode: 'soft' as const, shiftId: id };
    }

    // Hard delete: no references — drop weekday rules then the shift.
    await db.transaction(async (tx) => {
      await tx.delete(shiftWeekdayRules).where(eq(shiftWeekdayRules.shift_id, id));
      await tx.delete(shifts).where(eq(shifts.id, id));
    });
    return { success: true, mode: 'hard' as const, shiftId: id };
  } catch (e) {
    mapDbError(e, 'attendance.deleteShift');
    return { success: false, reason: 'error' as const };
  }
}

async function isShiftUsed(shiftId: number): Promise<boolean> {
  const [assignment] = await db
    .select({ id: scheduleAssignments.id })
    .from(scheduleAssignments)
    .where(eq(scheduleAssignments.shift_id, shiftId))
    .limit(1);
  if (assignment) return true;
  const [employeeShift] = await db
    .select({ id: employeeShifts.id })
    .from(employeeShifts)
    .where(eq(employeeShifts.shift_id, shiftId))
    .limit(1);
  if (employeeShift) return true;
  const [checklist] = await db
    .select({ id: dailyChecklists.id })
    .from(dailyChecklists)
    .where(eq(dailyChecklists.shift_id, shiftId))
    .limit(1);
  return Boolean(checklist);
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

// --- National Holidays CRUD ---

export type NewNationalHoliday = {
  date: string;
  name: string;
  description?: string | null;
  is_recurring?: boolean;
  year?: number | null;
  source?: 'manual' | 'imported';
  is_override?: boolean;
};

export async function getNationalHolidays(year?: number) {
  try {
    // Recurring holidays (year = null) apply to every year; dated holidays belong to their year.
    const where =
      year !== undefined
        ? or(eq(nationalHolidays.year, year), eq(nationalHolidays.is_recurring, true))
        : undefined;
    const rows = await db
      .select()
      .from(nationalHolidays)
      .where(where)
      .orderBy(asc(nationalHolidays.date));

    return { success: true, holidays: rows };
  } catch (e) {
    mapDbError(e, 'attendance.getNationalHolidays');
    return { success: false, holidays: [] };
  }
}

export async function getNationalHoliday(id: number) {
  try {
    const [holiday] = await db
      .select()
      .from(nationalHolidays)
      .where(eq(nationalHolidays.id, id))
      .limit(1);

    if (!holiday) {
      return { success: false, holiday: undefined };
    }

    return { success: true, holiday };
  } catch (e) {
    mapDbError(e, 'attendance.getNationalHoliday');
    return { success: false, holiday: undefined };
  }
}

export async function createNationalHoliday(input: NewNationalHoliday) {
  try {
    const [holiday] = await db
      .insert(nationalHolidays)
      .values({
        date: input.date,
        name: input.name,
        description: input.description ?? null,
        is_recurring: input.is_recurring ?? false,
        year: input.year ?? null,
        source: input.source ?? 'manual',
        is_override: input.is_override ?? false
      })
      .returning();

    return { success: true, holiday };
  } catch (e) {
    mapDbError(e, 'attendance.createNationalHoliday');
    return { success: false };
  }
}

export async function updateNationalHoliday(id: number, input: Partial<NewNationalHoliday>) {
  try {
    const patch: Record<string, unknown> = {};
    if (input.date !== undefined) patch.date = input.date;
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.is_recurring !== undefined) patch.is_recurring = input.is_recurring;
    if (input.year !== undefined) patch.year = input.year;
    if (input.source !== undefined) patch.source = input.source;
    if (input.is_override !== undefined) patch.is_override = input.is_override;
    patch.updated_at = new Date();

    const [holiday] = await db
      .update(nationalHolidays)
      .set(patch)
      .where(eq(nationalHolidays.id, id))
      .returning();

    if (!holiday) {
      return { success: false, holiday: undefined };
    }

    return { success: true, holiday };
  } catch (e) {
    mapDbError(e, 'attendance.updateNationalHoliday');
    return { success: false };
  }
}

export async function deleteNationalHoliday(id: number) {
  try {
    await db.delete(nationalHolidays).where(eq(nationalHolidays.id, id));
    return { success: true };
  } catch (e) {
    mapDbError(e, 'attendance.deleteNationalHoliday');
    return { success: false };
  }
}

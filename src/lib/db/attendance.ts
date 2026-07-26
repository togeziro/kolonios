import { and, eq, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { employeeShifts, locations, shifts, leaves, performanceReports } from './schema/attendance';
import type {
  AttendanceCheckInPayload,
  AttendanceCheckOutPayload,
  AttendanceFilters,
  AttendanceHistoryResponse,
  LeaveRequestPayload,
  LeaveFilters,
  LeaveListResponse,
  PerformanceStatsResponse
} from '@/features/attendance/api/types';

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
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 10)));
    const offset = (page - 1) * limit;

    const conditions = [eq(employeeShifts.user_id, userId)];
    if (filters.month && filters.year) {
      const monthStr = String(filters.month).padStart(2, '0');
      const startDate = `${filters.year}-${monthStr}-01`;
      const endDate = `${filters.year}-${monthStr}-31`;
      conditions.push(gte(employeeShifts.date, startDate));
      conditions.push(lte(employeeShifts.date, endDate));
    }
    if (filters.status) {
      conditions.push(eq(employeeShifts.attendance_status, filters.status));
    }

    const where = and(...conditions);

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

    const existing = await db
      .select()
      .from(employeeShifts)
      .where(and(eq(employeeShifts.user_id, userId), eq(employeeShifts.date, today)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].check_in_time) {
        return {
          success: false,
          message: 'Already checked in today'
        };
      }
    }

    let distanceToOffice: number | null = null;
    if (payload.latitude != null && payload.longitude != null && payload.locationId) {
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

    const [record] = await db
      .insert(employeeShifts)
      .values({
        user_id: userId,
        shift_id: payload.shiftId ?? null,
        date: today,
        check_in_time: now,
        late_duration: payload.lateDuration ?? null,
        check_in_latitude: payload.latitude ?? null,
        check_in_longitude: payload.longitude ?? null,
        distance_to_office_in: distanceToOffice,
        check_in_photo: payload.photo ?? null,
        check_in_note: payload.note ?? null,
        lock_location: payload.locationId ?? null,
        attendance_status: distanceToOffice != null && distanceToOffice > 0 ? 'present' : 'present'
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
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 10)));
    const offset = (page - 1) * limit;

    const conditions = [eq(leaves.user_id, userId)];
    if (filters.status) {
      conditions.push(eq(leaves.status, filters.status));
    }
    if (filters.leaveType) {
      conditions.push(eq(leaves.leave_type, filters.leaveType));
    }

    const where = and(...conditions);

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

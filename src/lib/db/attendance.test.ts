import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import {
  calculateDistance,
  validateGpsLocation,
  getLocations,
  getShifts,
  createLeaveRequest,
  getMyLeaves,
  getPerformanceStats,
  getAttendanceSummary,
  getEmployeeAttendance,
  getAttendanceHistory,
  getEffectiveEmployeeSchedule,
  getAttendancePolicy,
  getMonthlyScheduleData,
  getHolidaysInRange,
  getShiftWeekdayRules,
  createScheduleAssignment,
  createDayOff,
  createAttendanceCorrection,
  checkIn,
  checkOut,
  requestAttendanceCorrection,
  reviewAttendanceCorrection,
  getAdminAttendanceReport,
  getNationalHolidays,
  getNationalHoliday,
  createNationalHoliday,
  updateNationalHoliday,
  deleteNationalHoliday,
  createSchedule,
  updateSchedule,
  deleteShift,
  listShifts
} from './attendance';
import {
  resetAllTables,
  seedLocation,
  seedShift,
  seedShiftWeekdayRule,
  seedScheduleAssignment,
  seedDateOverride,
  seedDayOff,
  seedEmployee
} from '@/test-utils/db';
import { db } from '@/lib/db';
import { businessDateInTimeZone } from '@/lib/dates';
import {
  employeeShifts,
  performanceReports,
  leaveTypeConfigs,
  attendanceCorrections,
  nationalHolidays
} from './schema/attendance';

const TEST_USER_ID = 'test-user-att-123';

describe('calculateDistance (Haversine)', () => {
  it('returns 0 for the same coordinates', () => {
    expect(calculateDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('calculates distance between NYC and LA (~3940 km)', () => {
    const d = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(3900_000);
    expect(d).toBeLessThan(4000_000);
  });

  it('calculates a short distance (~111 km per degree latitude)', () => {
    const d = calculateDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('handles negative coordinates (southern hemisphere)', () => {
    const d = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(d).toBeGreaterThan(700_000);
    expect(d).toBeLessThan(750_000);
  });
});

describe('attendance data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('validateGpsLocation', () => {
    const policy = {
      gpsValidationEnabled: true,
      selfieRequired: false,
      maxAccuracyMeters: 50,
      maxStaleMs: 30_000
    };

    it('rejects when any coordinate field is missing', async () => {
      const res = await validateGpsLocation({
        latitude: -6.2,
        longitude: 106.85,
        accuracy: 10,
        capturedAt: Date.now(),
        locationId: 1,
        policy
      });
      if (res.ok) throw new Error('expected failure');
      expect(res.code).toBe('GPS_REQUIRED');
    });

    it('rejects stale coordinates', async () => {
      const loc = await seedLocation({ gps_validation_enabled: true });
      const res = await validateGpsLocation({
        latitude: loc.latitude!,
        longitude: loc.longitude!,
        accuracy: 10,
        capturedAt: Date.now() - 120_000,
        locationId: loc.id,
        policy
      });
      if (res.ok) throw new Error('expected failure');
      expect(res.code).toBe('GPS_STALE');
    });

    it('rejects low-accuracy coordinates', async () => {
      const loc = await seedLocation({ gps_validation_enabled: true });
      const res = await validateGpsLocation({
        latitude: loc.latitude!,
        longitude: loc.longitude!,
        accuracy: 500,
        capturedAt: Date.now(),
        locationId: loc.id,
        policy
      });
      if (res.ok) throw new Error('expected failure');
      expect(res.code).toBe('GPS_INACCURATE');
    });

    it('rejects positions outside the geofence radius', async () => {
      const loc = await seedLocation({ latitude: -6.2, longitude: 106.85, radius: 50 });
      const res = await validateGpsLocation({
        latitude: -7.0,
        longitude: 106.85,
        accuracy: 10,
        capturedAt: Date.now(),
        locationId: loc.id,
        policy
      });
      if (res.ok) throw new Error('expected failure');
      expect(res.code).toBe('OUTSIDE_RADIUS');
    });

    it('returns the distance when the position is valid', async () => {
      const loc = await seedLocation({ latitude: -6.2, longitude: 106.85, radius: 500 });
      const res = await validateGpsLocation({
        latitude: -6.2,
        longitude: 106.85,
        accuracy: 10,
        capturedAt: Date.now(),
        locationId: loc.id,
        policy
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.distanceToOffice).toBe(0);
    });
  });

  describe('locations', () => {
    it('returns empty when no active locations exist', async () => {
      const res = await getLocations();
      expect(res.success).toBe(true);
      expect(res.locations).toHaveLength(0);
    });

    it('returns active locations', async () => {
      await seedLocation({ name: 'Office A' });
      await seedLocation({ name: 'Office B', status: 'inactive' });

      const res = await getLocations();
      expect(res.success).toBe(true);
      expect(res.locations).toHaveLength(1);
      expect(res.locations[0].name).toBe('Office A');
    });
  });

  describe('shifts', () => {
    it('returns empty when no active shifts exist', async () => {
      const res = await getShifts();
      expect(res.success).toBe(true);
      expect(res.shifts).toHaveLength(0);
    });

    it('returns active shifts', async () => {
      await seedShift({ name: 'Morning' });
      await seedShift({ name: 'Night', status: 'inactive' as const });

      const res = await getShifts();
      expect(res.success).toBe(true);
      expect(res.shifts).toHaveLength(1);
      expect(res.shifts[0].name).toBe('Morning');
    });
  });

  describe('leave requests', () => {
    it('creates a leave request and calculates total days', async () => {
      const res = await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'annual',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        reason: 'Vacation'
      });

      expect(res.success).toBe(true);
      expect(res.leave).toBeDefined();
      expect(res.leave!.total_days).toBe(5);
      expect(res.leave!.leave_type).toBe('annual');
      expect(res.leave!.status).toBe('pending');
    });

    it('calculates 1 day for same start and end date', async () => {
      const res = await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'sick',
        startDate: '2026-08-01',
        endDate: '2026-08-01'
      });

      expect(res.success).toBe(true);
      expect(res.leave!.total_days).toBe(1);
    });

    it('lists my leaves with pagination', async () => {
      await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'annual',
        startDate: '2026-08-01',
        endDate: '2026-08-03'
      });
      await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'sick',
        startDate: '2026-09-01',
        endDate: '2026-09-02'
      });

      const res = await getMyLeaves(TEST_USER_ID, { page: 1, limit: 10 });
      expect(res.success).toBe(true);
      expect(res.total).toBe(2);
      expect(res.leaves).toHaveLength(2);
    });

    it('does not return leaves for another user', async () => {
      await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'annual',
        startDate: '2026-08-01',
        endDate: '2026-08-03'
      });

      const res = await getMyLeaves('other-user-456', {});
      expect(res.success).toBe(true);
      expect(res.total).toBe(0);
    });

    it('filters leaves by status', async () => {
      await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'annual',
        startDate: '2026-08-01',
        endDate: '2026-08-03'
      });

      const res = await getMyLeaves(TEST_USER_ID, { status: 'pending' });
      expect(res.success).toBe(true);
      expect(res.total).toBe(1);

      const rejected = await getMyLeaves(TEST_USER_ID, { status: 'approved' });
      expect(rejected.total).toBe(0);
    });

    it('filters leaves by leave type', async () => {
      await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'annual',
        startDate: '2026-08-01',
        endDate: '2026-08-03'
      });
      await createLeaveRequest(TEST_USER_ID, {
        leaveType: 'sick',
        startDate: '2026-09-01',
        endDate: '2026-09-01'
      });

      const annual = await getMyLeaves(TEST_USER_ID, { leaveType: 'annual' });
      expect(annual.total).toBe(1);

      const sick = await getMyLeaves(TEST_USER_ID, { leaveType: 'sick' });
      expect(sick.total).toBe(1);
    });
  });

  describe('performance stats', () => {
    it('returns empty for a user with no reports', async () => {
      const res = await getPerformanceStats(TEST_USER_ID);
      expect(res.success).toBe(true);
      expect(res.reports).toHaveLength(0);
    });

    it('returns reports ordered by date ascending', async () => {
      await db.insert(performanceReports).values([
        { user_id: TEST_USER_ID, date: '2026-07-02', score: '85' },
        { user_id: TEST_USER_ID, date: '2026-07-01', score: '90' }
      ]);

      const res = await getPerformanceStats(TEST_USER_ID);
      expect(res.success).toBe(true);
      expect(res.reports).toHaveLength(2);
      expect(res.reports![0].date).toBe('2026-07-01');
      expect(res.reports![1].date).toBe('2026-07-02');
    });

    it('does not return reports for another user', async () => {
      await db
        .insert(performanceReports)
        .values([{ user_id: 'other-user-456', date: '2026-07-01', score: '90' }]);

      const res = await getPerformanceStats(TEST_USER_ID);
      expect(res.reports).toHaveLength(0);
    });
  });

  describe('attendance summary', () => {
    it('returns zero totals when no records exist', async () => {
      const res = await getAttendanceSummary(TEST_USER_ID);
      expect(res.success).toBe(true);
      expect(res.summary.total).toBe(0);
      expect(res.summary.present).toBe(0);
    });

    it('counts present, late, and absent statuses', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      await db.insert(employeeShifts).values([
        { user_id: TEST_USER_ID, date: `${currentMonth}-01`, attendance_status: 'present' },
        { user_id: TEST_USER_ID, date: `${currentMonth}-02`, attendance_status: 'late' },
        { user_id: TEST_USER_ID, date: `${currentMonth}-03`, attendance_status: 'absent' },
        { user_id: TEST_USER_ID, date: `${currentMonth}-04`, attendance_status: 'present' }
      ]);

      const res = await getAttendanceSummary(TEST_USER_ID);
      expect(res.success).toBe(true);
      expect(res.summary.total).toBe(4);
      expect(res.summary.present).toBe(3);
      expect(res.summary.late).toBe(1);
      expect(res.summary.absent).toBe(1);
    });
  });

  describe('employee attendance', () => {
    it('returns null when no attendance exists for today', async () => {
      const res = await getEmployeeAttendance(TEST_USER_ID);
      expect(res.success).toBe(true);
      expect(res.attendance).toBeNull();
    });

    it('returns an attendance record for a given date', async () => {
      await db.insert(employeeShifts).values({
        user_id: TEST_USER_ID,
        date: '2026-07-30',
        check_in_time: '09:00',
        attendance_status: 'present'
      });

      const res = await getEmployeeAttendance(TEST_USER_ID, '2026-07-30');
      expect(res.success).toBe(true);
      expect(res.attendance).not.toBeNull();
      expect(res.attendance!.attendance.check_in_time).toBe('09:00');
    });

    it('uses the business timezone default for "today"', async () => {
      // The record exists only in the WIB business day that the current instant
      // resolves to; the UTC date could be the previous day near midnight.
      const today = businessDateInTimeZone(new Date());
      await db.insert(employeeShifts).values({
        user_id: TEST_USER_ID,
        date: today,
        check_in_time: '09:00',
        attendance_status: 'present'
      });
      const res = await getEmployeeAttendance(TEST_USER_ID);
      expect(res.success).toBe(true);
      expect(res.attendance?.attendance.date).toBe(today);
    });
  });

  describe('attendance history', () => {
    it('returns empty history with pagination metadata', async () => {
      const res = await getAttendanceHistory(TEST_USER_ID, { page: 1, limit: 10 });
      expect(res.success).toBe(true);
      expect(res.total).toBe(0);
      expect(res.records).toHaveLength(0);
    });

    it('filters by month and year', async () => {
      await db.insert(employeeShifts).values([
        { user_id: TEST_USER_ID, date: '2026-07-01', attendance_status: 'present' },
        { user_id: TEST_USER_ID, date: '2026-07-15', attendance_status: 'present' },
        { user_id: TEST_USER_ID, date: '2026-08-01', attendance_status: 'late' }
      ]);

      const res = await getAttendanceHistory(TEST_USER_ID, { month: 7, year: 2026 });
      expect(res.total).toBe(2);
    });

    it('filters by status', async () => {
      await db.insert(employeeShifts).values([
        { user_id: TEST_USER_ID, date: '2026-07-01', attendance_status: 'present' },
        { user_id: TEST_USER_ID, date: '2026-07-02', attendance_status: 'late' }
      ]);

      const res = await getAttendanceHistory(TEST_USER_ID, { status: 'late' });
      expect(res.total).toBe(1);
    });
  });

  describe('schedule resolution', () => {
    it('returns null when the employee has no active assignment', async () => {
      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
      expect(res).toBeNull();
    });

    it('returns the weekday rule for a working day', async () => {
      const shift = await seedShift({
        name: 'Morning',
        late_tolerance_minutes: 10,
        absence_cutoff_minutes: 120
      });
      await seedShiftWeekdayRule(shift.id, {
        day_of_week: 1, // Monday
        start_time: '08:00',
        end_time: '17:00'
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });

      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
      expect(res).not.toBeNull();
      expect(res!.shiftId).toBe(shift.id);
      expect(res!.startTime).toBe('08:00');
      expect(res!.endTime).toBe('17:00');
      // Tolerance comes from the shift row (ADR-0004), not the weekday rule
      expect(res!.lateToleranceMinutes).toBe(10);
      expect(res!.absenceCutoffMinutes).toBe(120);
    });

    it('date override uses the override shift policy for tolerance', async () => {
      const morning = await seedShift({ name: 'Morning', late_tolerance_minutes: 10 });
      const night = await seedShift({
        name: 'Night',
        start_time: '20:00',
        end_time: '04:00',
        late_tolerance_minutes: 25
      });
      await seedShiftWeekdayRule(morning.id, {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00'
      });
      await seedShiftWeekdayRule(night.id, {
        day_of_week: 1,
        start_time: '20:00',
        end_time: '04:00'
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: morning.id });
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-08-03', shift_id: night.id });

      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
      expect(res).not.toBeNull();
      expect(res!.shiftId).toBe(night.id);
      expect(res!.startTime).toBe('20:00');
      expect(res!.lateToleranceMinutes).toBe(25);
    });

    it('returns null for a non-working weekday (Saturday)', async () => {
      const shift = await seedShift({ name: 'Morning' });
      await seedShiftWeekdayRule(shift.id, {
        day_of_week: 6, // Saturday
        is_working_day: false
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });

      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-08');
      expect(res).toBeNull();
    });

    it('returns null when the date is a day off', async () => {
      const shift = await seedShift({ name: 'Morning' });
      await seedShiftWeekdayRule(shift.id, {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00'
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-08-03' });

      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
      expect(res).toBeNull();
    });

    it('applies a date override for the shift on that date', async () => {
      const morning = await seedShift({ name: 'Morning' });
      const night = await seedShift({ name: 'Night', start_time: '20:00', end_time: '04:00' });
      await seedShiftWeekdayRule(morning.id, {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00'
      });
      await seedShiftWeekdayRule(night.id, {
        day_of_week: 1,
        start_time: '20:00',
        end_time: '04:00'
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: morning.id });
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-08-03', shift_id: night.id });

      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
      expect(res).not.toBeNull();
      expect(res!.shiftId).toBe(night.id);
      expect(res!.startTime).toBe('20:00');
    });

    it('day off takes precedence over a date override', async () => {
      const morning = await seedShift({ name: 'Morning' });
      const night = await seedShift({ name: 'Night', start_time: '20:00', end_time: '04:00' });
      await seedShiftWeekdayRule(morning.id, {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00'
      });
      await seedShiftWeekdayRule(night.id, {
        day_of_week: 1,
        start_time: '20:00',
        end_time: '04:00'
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: morning.id });
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-08-03', shift_id: night.id });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-08-03' });

      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
      expect(res).toBeNull();
    });

    it('migration backfill (0032): shift tolerance = MAX of weekday-rule tolerances', async () => {
      // Pre-migration state: a shift with weekday rules carrying varied per-day
      // tolerance. The migration's UPDATE-from-MAX must promote those into the
      // shift row. This test exercises the EXACT statements in 0032 by reading
      // the migration file and executing it — if the SQL drifts, the test
      // drifts with it.
      const { shifts, shiftWeekdayRules } = await import('./schema/attendance');
      const [shift] = await db
        .insert(shifts)
        .values({ name: 'Backfill subject', start_time: '08:00', end_time: '17:00' })
        .returning();
      await db.insert(shiftWeekdayRules).values([
        {
          shift_id: shift.id,
          day_of_week: 1,
          is_working_day: true,
          start_time: '08:00',
          end_time: '17:00',
          late_tolerance_minutes: 5,
          absence_cutoff_minutes: 60
        },
        {
          shift_id: shift.id,
          day_of_week: 2,
          is_working_day: true,
          start_time: '08:00',
          end_time: '17:00',
          late_tolerance_minutes: 12,
          absence_cutoff_minutes: 180
        },
        {
          shift_id: shift.id,
          day_of_week: 6,
          is_working_day: false,
          start_time: null,
          end_time: null,
          late_tolerance_minutes: 0,
          absence_cutoff_minutes: 0
        }
      ]);

      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const { resolve } = await import('node:path');
      const migrationPath = fileURLToPath(
        new URL('./migrations/0032_gorgeous_mother_askani.sql', import.meta.url)
      );
      const raw = await readFile(migrationPath, 'utf8');

      // Run the migration's ADD-COLUMN + UPDATE statements against this test's
      // shift only. ADD COLUMN is idempotent (column already exists from prior
      // migrations in the test DB); the UPDATE statements are the contract.
      const statements = raw
        .split(/-->\s*statement-breakpoint/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        // The test DB already has the migration's schema applied, so we only
        // need to re-run the UPDATE statements that this test exercises.
        // (ADD COLUMN would fail; ALTER COLUMN DROP DEFAULT is a no-op.)
        if (stmt.startsWith('UPDATE "shifts"')) {
          await db.execute(sql.raw(stmt));
        }
      }

      const [after] = await db.select().from(shifts).where(eq(shifts.id, shift.id));
      expect(after.late_tolerance_minutes).toBe(12); // max(5, 12, 0)
      expect(after.absence_cutoff_minutes).toBe(180); // max(60, 180, 0)
    });
  });

  describe('monthly schedule data', () => {
    it('returns null assignment plus empty collections when no assignment exists', async () => {
      const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-08');
      expect(res.assignment).toBeNull();
      expect(res.weekdayRules).toEqual([]);
      expect(res.overrides).toEqual([]);
      expect(res.dayOffs).toEqual([]);
      expect(res.holidays).toEqual([]);
    });

    it('returns assignment, rules, shift policies, overrides and day offs within the month', async () => {
      const shift = await seedShift({
        name: 'Morning',
        late_tolerance_minutes: 10,
        absence_cutoff_minutes: 120
      });
      await seedShiftWeekdayRule(shift.id, {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00'
      });
      await seedShiftWeekdayRule(shift.id, {
        day_of_week: 6,
        is_working_day: false
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });
      await seedDateOverride({ user_id: TEST_USER_ID, date: '2026-08-04', shift_id: shift.id });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-08-05' });

      const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-08');

      expect(res.assignment).not.toBeNull();
      expect(res.assignment!.shiftId).toBe(shift.id);
      expect(res.assignment!.shiftName).toBe('Morning');
      expect(res.weekdayRules).toHaveLength(2);
      expect(res.weekdayRules.find((r) => r.dayOfWeek === 1)?.startTime).toBe('08:00');
      expect(res.weekdayRules.find((r) => r.dayOfWeek === 6)?.isWorkingDay).toBe(false);
      // Shift-wide policy comes from the shift row (ADR-0004)
      expect(res.shiftPolicies).toEqual([
        { shiftId: shift.id, lateToleranceMinutes: 10, absenceCutoffMinutes: 120 }
      ]);
      expect(res.overrides).toEqual([{ date: '2026-08-04', shiftId: shift.id }]);
      expect(res.dayOffs).toEqual(['2026-08-05']);
    });

    it('excludes records outside the requested month', async () => {
      const shift = await seedShift({ name: 'Morning' });
      await seedShiftWeekdayRule(shift.id, { day_of_week: 1 });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-07-31' });
      await seedDayOff({ user_id: TEST_USER_ID, date: '2026-09-01' });

      const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-08');
      expect(res.dayOffs).toEqual([]);
    });

    it('returns an assignment that starts mid-month', async () => {
      const shift = await seedShift({ name: 'Morning' });
      await seedShiftWeekdayRule(shift.id, { day_of_week: 1 });
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: shift.id,
        effective_from: '2026-08-10',
        effective_to: null
      });

      const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-08');
      expect(res.assignment).not.toBeNull();
      expect(res.assignment!.shiftId).toBe(shift.id);
      expect(res.assignment!.shiftName).toBe('Morning');
    });

    it('excludes an assignment that ended before the month and picks the latest overlapping one', async () => {
      const staleShift = await seedShift({ name: 'Stale' });
      const olderShift = await seedShift({ name: 'Older' });
      const latestShift = await seedShift({ name: 'Latest' });
      await seedShiftWeekdayRule(staleShift.id, { day_of_week: 1 });
      await seedShiftWeekdayRule(olderShift.id, { day_of_week: 1 });
      await seedShiftWeekdayRule(latestShift.id, { day_of_week: 1 });
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: staleShift.id,
        effective_from: '2026-01-01',
        effective_to: '2026-07-31'
      });
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: olderShift.id,
        effective_from: '2026-07-01',
        effective_to: '2026-09-30'
      });
      await seedScheduleAssignment({
        user_id: TEST_USER_ID,
        shift_id: latestShift.id,
        effective_from: '2026-08-10',
        effective_to: null
      });

      const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-08');
      expect(res.assignment).not.toBeNull();
      expect(res.assignment!.shiftId).toBe(latestShift.id);
      expect(res.assignment!.shiftName).toBe('Latest');
    });

    it('includes national holidays inside the month and recurring holidays by month-day', async () => {
      const shift = await seedShift({ name: 'Morning' });
      await seedShiftWeekdayRule(shift.id, { day_of_week: 1 });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });
      await db.insert(nationalHolidays).values([
        { date: '2026-08-17', name: 'Independence Day', is_recurring: false, year: 2026 },
        { date: '1999-08-21', name: 'Recurring Aug 21', is_recurring: true, year: null },
        { date: '2026-09-01', name: 'September day', is_recurring: false, year: 2026 }
      ]);

      const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-08');
      expect(res.holidays).toEqual(
        expect.arrayContaining([
          { date: '2026-08-17', name: 'Independence Day', isRecurring: false },
          { date: '1999-08-21', name: 'Recurring Aug 21', isRecurring: true }
        ])
      );
      expect(res.holidays).not.toEqual(
        expect.arrayContaining([{ date: '2026-09-01', name: 'September day' }])
      );
    });
  });

  describe('attendance policy', () => {
    it('returns location policy defaults when no location exists', async () => {
      const policy = await getAttendancePolicy(null, null);
      expect(policy.gpsValidationEnabled).toBe(true);
      expect(policy.selfieRequired).toBe(false);
      expect(policy.maxAccuracyMeters).toBe(50);
      expect(policy.maxStaleMs).toBe(30000);
    });

    it('reads policy configuration from the location', async () => {
      const loc = await seedLocation({
        gps_validation_enabled: false,
        selfie_required: true,
        max_accuracy_meters: 25,
        max_stale_ms: 15000
      });

      const policy = await getAttendancePolicy(loc.id, null);
      expect(policy.gpsValidationEnabled).toBe(false);
      expect(policy.selfieRequired).toBe(true);
      expect(policy.maxAccuracyMeters).toBe(25);
      expect(policy.maxStaleMs).toBe(15000);
    });
  });

  describe('schedule management CRUD', () => {
    it('lists weekday rules for a shift', async () => {
      const shift = await seedShift({ name: 'Morning' });
      await seedShiftWeekdayRule(shift.id, { day_of_week: 1 });
      await seedShiftWeekdayRule(shift.id, { day_of_week: 2 });

      const res = await getShiftWeekdayRules(shift.id);
      expect(res.success).toBe(true);
      expect(res.rules).toHaveLength(2);
    });

    it('creates a schedule assignment', async () => {
      const shift = await seedShift({ name: 'Morning' });
      const res = await createScheduleAssignment({
        userId: TEST_USER_ID,
        shiftId: shift.id,
        effectiveFrom: '2026-08-01',
        createdBy: 'test-admin'
      });

      expect(res.success).toBe(true);
      expect(res.assignment!.user_id).toBe(TEST_USER_ID);
      expect(res.assignment!.shift_id).toBe(shift.id);
    });

    it('creates a day off', async () => {
      const res = await createDayOff({
        userId: TEST_USER_ID,
        date: '2026-08-05',
        reason: 'Family event',
        createdBy: 'test-admin'
      });

      expect(res.success).toBe(true);
      expect(res.dayOff!.date).toBe('2026-08-05');
      expect(res.dayOff!.reason).toBe('Family event');
    });

    it('creates an attendance correction with actor and reason', async () => {
      const [attendance] = await db
        .insert(employeeShifts)
        .values({ user_id: TEST_USER_ID, date: '2026-08-03', attendance_status: 'present' })
        .returning();

      const res = await createAttendanceCorrection({
        attendanceId: attendance.id,
        actorId: 'test-admin',
        reason: 'Wrong check-out time',
        previousValues: JSON.stringify({ check_out_time: '16:00' }),
        newValues: JSON.stringify({ check_out_time: '17:00' })
      });

      expect(res.success).toBe(true);
      expect(res.correction!.actor_id).toBe('test-admin');
      expect(res.correction!.reason).toBe('Wrong check-out time');
    });
  });
});

describe('check-in validation with schedules and policies', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  async function seedActiveSchedule() {
    const shift = await seedShift({ name: 'Morning' });
    await seedShiftWeekdayRule(shift.id, {
      day_of_week: new Date(businessDateInTimeZone(new Date())).getDay(),
      is_working_day: true,
      start_time: '00:00',
      end_time: '23:59'
    });
    await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });
    return shift;
  }

  it('rejects check-in when the employee has no active schedule', async () => {
    const res = await checkIn(TEST_USER_ID, { latitude: -6.2, longitude: 106.85 });
    expect(res.success).toBe(false);
  });

  it('accepts check-in without GPS when policy allows and stores context', async () => {
    await seedActiveSchedule();
    const loc = await seedLocation({
      gps_validation_enabled: false,
      selfie_required: false
    });

    const res = await checkIn(TEST_USER_ID, { locationId: loc.id });
    expect(res.success).toBe(true);
    expect(res.attendance!.gps_validation_enabled).toBe(false);
    expect(res.attendance!.validation_state).toBe('disabled');
  });

  it('stores coordinates and accuracy on check-in', async () => {
    await seedActiveSchedule();
    const loc = await seedLocation({
      latitude: -6.2,
      longitude: 106.85,
      radius: 500,
      gps_validation_enabled: true
    });

    const res = await checkIn(TEST_USER_ID, {
      locationId: loc.id,
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 10,
      capturedAt: Date.now()
    });
    expect(res.success).toBe(true);
    expect(res.attendance!.check_in_latitude).toBe(-6.2);
    expect(res.attendance!.check_in_accuracy).toBe(10);
    expect(res.attendance!.validation_state).toBe('valid');
  });

  it('rejects stale coordinates when GPS validation is enabled', async () => {
    await seedActiveSchedule();
    const loc = await seedLocation({
      latitude: -6.2,
      longitude: 106.85,
      radius: 500,
      gps_validation_enabled: true,
      max_stale_ms: 30000
    });

    const res = await checkIn(TEST_USER_ID, {
      locationId: loc.id,
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 10,
      capturedAt: Date.now() - 120_000
    });
    expect(res.success).toBe(false);
  });

  it('rejects positions outside the geofence radius', async () => {
    await seedActiveSchedule();
    const loc = await seedLocation({
      latitude: -6.2,
      longitude: 106.85,
      radius: 50,
      gps_validation_enabled: true
    });

    // ~111km away
    const res = await checkIn(TEST_USER_ID, {
      locationId: loc.id,
      latitude: -7.0,
      longitude: 106.85,
      accuracy: 10,
      capturedAt: Date.now()
    });
    expect(res.success).toBe(false);
  });

  it('requires GPS coordinates when GPS validation is enabled', async () => {
    await seedActiveSchedule();
    await seedLocation({ gps_validation_enabled: true });

    const res = await checkIn(TEST_USER_ID, {});
    expect(res.success).toBe(false);
    expect(res.code).toBe('GPS_REQUIRED');
  });

  it('requires a location id when GPS validation is enabled', async () => {
    await seedActiveSchedule();
    await seedLocation({ gps_validation_enabled: true });

    const res = await checkIn(TEST_USER_ID, {
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 10,
      capturedAt: Date.now()
    });
    expect(res.success).toBe(false);
    expect(res.code).toBe('GPS_REQUIRED');
  });

  it('requires accuracy and capturedAt when GPS validation is enabled', async () => {
    await seedActiveSchedule();
    const loc = await seedLocation({ gps_validation_enabled: true });

    const res = await checkIn(TEST_USER_ID, {
      locationId: loc.id,
      latitude: -6.2,
      longitude: 106.85
    });
    expect(res.success).toBe(false);
    expect(res.code).toBe('GPS_REQUIRED');
  });

  it('rejects check-in without a selfie when the policy requires one', async () => {
    await seedActiveSchedule();
    const loc = await seedLocation({ gps_validation_enabled: true, selfie_required: true });

    const res = await checkIn(TEST_USER_ID, {
      locationId: loc.id,
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      capturedAt: Date.now()
    });
    expect(res.success).toBe(false);
    expect(res.code).toBe('SELFIE_REQUIRED');
  });

  it('accepts check-in with a selfie when the policy requires one', async () => {
    await seedActiveSchedule();
    const loc = await seedLocation({ gps_validation_enabled: true, selfie_required: true });

    const res = await checkIn(TEST_USER_ID, {
      locationId: loc.id,
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      capturedAt: Date.now(),
      photo: 'data:image/jpeg;base64,selfie'
    });
    expect(res.success).toBe(true);
    expect(res.attendance!.check_in_photo).toBe('data:image/jpeg;base64,selfie');
  });
});

describe('check-out validation with stored policies', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  async function seedCheckedInRecord(overrides: Partial<typeof employeeShifts.$inferInsert> = {}) {
    const loc = await seedLocation({ gps_validation_enabled: true, selfie_required: false });
    const [record] = await db
      .insert(employeeShifts)
      .values({
        user_id: TEST_USER_ID,
        date: businessDateInTimeZone(new Date()),
        shift_id: 1,
        check_in_time: '08:00',
        attendance_status: 'present',
        gps_validation_enabled: true,
        selfie_required: false,
        lock_location: loc.id,
        ...overrides
      })
      .returning();
    return { record, loc };
  }

  it('rejects check-out without GPS when the record policy requires it', async () => {
    const { record } = await seedCheckedInRecord();
    const res = await checkOut(TEST_USER_ID, { attendanceId: record.id });
    expect(res.success).toBe(false);
    expect(res.code).toBe('GPS_REQUIRED');
  });

  it('rejects check-out without a selfie when the record requires one', async () => {
    const { record } = await seedCheckedInRecord({ selfie_required: true });
    const res = await checkOut(TEST_USER_ID, {
      attendanceId: record.id,
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      capturedAt: Date.now()
    });
    expect(res.success).toBe(false);
    expect(res.code).toBe('SELFIE_REQUIRED');
  });

  it('accepts check-out with valid GPS and stores coordinates', async () => {
    const { record } = await seedCheckedInRecord();
    const res = await checkOut(TEST_USER_ID, {
      attendanceId: record.id,
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      capturedAt: Date.now()
    });
    expect(res.success).toBe(true);
    expect(res.attendance!.check_out_latitude).toBe(40.7128);
    expect(res.attendance!.check_out_accuracy).toBe(10);
  });

  it('rejects check-out outside the geofence of the locked location', async () => {
    const { record } = await seedCheckedInRecord();
    // ~111km away from the locked location (40.7128, -74.006)
    const res = await checkOut(TEST_USER_ID, {
      attendanceId: record.id,
      latitude: 41.7,
      longitude: -74.006,
      accuracy: 10,
      capturedAt: Date.now()
    });
    expect(res.success).toBe(false);
    expect(res.code).toBe('OUTSIDE_RADIUS');
  });

  it('does not require GPS on check-out when the record policy is disabled', async () => {
    const loc = await seedLocation({ gps_validation_enabled: false });
    const [record] = await db
      .insert(employeeShifts)
      .values({
        user_id: TEST_USER_ID,
        date: businessDateInTimeZone(new Date()),
        check_in_time: '08:00',
        attendance_status: 'present',
        gps_validation_enabled: false,
        selfie_required: false,
        lock_location: loc.id
      })
      .returning();

    const res = await checkOut(TEST_USER_ID, { attendanceId: record.id });
    expect(res.success).toBe(true);
  });
});

describe('leave attachment policy and corrections', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  it('rejects leave requests missing a required attachment', async () => {
    await db.insert(leaveTypeConfigs).values({ leave_type: 'sick', attachment_required: true });

    const res = await createLeaveRequest(TEST_USER_ID, {
      leaveType: 'sick',
      startDate: '2026-08-01',
      endDate: '2026-08-01'
    });
    expect(res.success).toBe(false);
  });

  it('accepts leave requests with a required attachment', async () => {
    await db.insert(leaveTypeConfigs).values({ leave_type: 'sick', attachment_required: true });

    const res = await createLeaveRequest(TEST_USER_ID, {
      leaveType: 'sick',
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      file: 'doctor-note.pdf'
    });
    expect(res.success).toBe(true);
  });

  it('accepts leave requests when no attachment is required', async () => {
    const res = await createLeaveRequest(TEST_USER_ID, {
      leaveType: 'annual',
      startDate: '2026-08-01',
      endDate: '2026-08-03'
    });
    expect(res.success).toBe(true);
  });

  it('records before/after values when a correction is reviewed', async () => {
    const [attendance] = await db
      .insert(employeeShifts)
      .values({
        user_id: TEST_USER_ID,
        date: '2026-08-03',
        check_in_time: '08:00',
        attendance_status: 'present',
        requested_check_in_time: '09:00',
        request_status: 'pending'
      })
      .returning();

    const res = await reviewAttendanceCorrection(TEST_USER_ID, {
      attendanceId: attendance.id,
      decision: 'approve',
      reason: 'Late check-in due to traffic'
    });
    expect(res.success).toBe(true);
    expect(res.attendance!.check_in_time).toBe('09:00');
    expect(res.attendance!.request_status).toBe('approved');

    const [correction] = await db
      .select()
      .from(attendanceCorrections)
      .where(eq(attendanceCorrections.attendance_id, attendance.id))
      .limit(1);
    expect(correction).toBeDefined();
    expect(correction.reason).toBe('Late check-in due to traffic');
    expect(JSON.parse(correction.previous_values!).check_in_time).toBe('08:00');
    expect(JSON.parse(correction.new_values!).check_in_time).toBe('09:00');
  });

  it('rejects a correction request for an attendance record that is not yours', async () => {
    const [attendance] = await db
      .insert(employeeShifts)
      .values({ user_id: 'other-user-456', date: '2026-08-03', attendance_status: 'present' })
      .returning();

    const res = await requestAttendanceCorrection(TEST_USER_ID, {
      attendanceId: attendance.id,
      note: 'Fix my time'
    });
    expect(res.success).toBe(false);
  });

  it('requests a correction and marks it pending', async () => {
    const [attendance] = await db
      .insert(employeeShifts)
      .values({ user_id: TEST_USER_ID, date: '2026-08-03', attendance_status: 'present' })
      .returning();

    const res = await requestAttendanceCorrection(TEST_USER_ID, {
      attendanceId: attendance.id,
      requestedCheckInTime: '09:00',
      note: 'Forgot to check in on time'
    });
    expect(res.success).toBe(true);
    expect(res.attendance!.request_status).toBe('pending');
    expect(res.attendance!.requested_check_in_time).toBe('09:00');
  });
});

describe('admin attendance report', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  it('returns daily detail records with employee/department/shift joins', async () => {
    const { department } = await seedEmployee('rep-user-1');
    const shift = await seedShift({ name: 'Morning' });
    const loc = await seedLocation({ name: 'Office' });
    await db.insert(employeeShifts).values({
      user_id: 'rep-user-1',
      shift_id: shift.id,
      lock_location: loc.id,
      date: '2026-08-03',
      check_in_time: '09:00',
      attendance_status: 'present'
    });

    const res = await getAdminAttendanceReport({ page: 1, limit: 10 });
    expect(res.success).toBe(true);
    expect(res.total).toBe(1);
    const row = res.records[0];
    expect(row.employee!.full_name).toBe('Test Employee');
    expect(row.department!.id).toBe(department.id);
    expect(row.shift!.name).toBe('Morning');
  });

  it('filters by status and date range', async () => {
    await seedEmployee('rep-user-2');
    await db.insert(employeeShifts).values([
      { user_id: 'rep-user-2', date: '2026-08-01', attendance_status: 'present' },
      { user_id: 'rep-user-2', date: '2026-08-02', attendance_status: 'late' },
      { user_id: 'rep-user-2', date: '2026-08-10', attendance_status: 'present' }
    ]);

    const res = await getAdminAttendanceReport({
      status: 'late',
      startDate: '2026-08-01',
      endDate: '2026-08-05'
    });
    expect(res.success).toBe(true);
    expect(res.total).toBe(1);
    expect(res.records[0].attendance.date).toBe('2026-08-02');
  });

  it('filters by locked location', async () => {
    await seedEmployee('rep-user-2');
    const locA = await seedLocation({ name: 'Office A' });
    const locB = await seedLocation({ name: 'Office B' });
    await db.insert(employeeShifts).values([
      {
        user_id: 'rep-user-2',
        date: '2026-08-01',
        attendance_status: 'present',
        lock_location: locA.id
      },
      {
        user_id: 'rep-user-2',
        date: '2026-08-02',
        attendance_status: 'present',
        lock_location: locB.id
      }
    ]);

    const res = await getAdminAttendanceReport({ locationId: locB.id });
    expect(res.success).toBe(true);
    expect(res.total).toBe(1);
    expect(res.records[0].attendance.date).toBe('2026-08-02');
  });

  it('paginates results', async () => {
    await seedEmployee('rep-user-3');
    for (let d = 1; d <= 5; d++) {
      await db.insert(employeeShifts).values({
        user_id: 'rep-user-3',
        date: `2026-08-0${d}`,
        attendance_status: 'present'
      });
    }

    const res = await getAdminAttendanceReport({ page: 2, limit: 2 });
    expect(res.success).toBe(true);
    expect(res.total).toBe(5);
    expect(res.records).toHaveLength(2);
    expect(res.offset).toBe(2);
  });
});

describe('national holidays', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('getHolidaysInRange', () => {
    it('returns an empty array when the range overlaps no holidays', async () => {
      const res = await getHolidaysInRange('2026-08-01', '2026-08-07');
      expect(res).toEqual([]);
    });

    it('returns the single holiday that falls on the exact day', async () => {
      await db.insert(nationalHolidays).values({
        date: '2026-08-17',
        name: 'Independence Day',
        is_recurring: false,
        year: 2026,
        source: 'manual' as const
      });

      const res = await getHolidaysInRange('2026-08-17', '2026-08-17');
      expect(res).toEqual([{ date: '2026-08-17', name: 'Independence Day', isRecurring: false }]);
    });

    it('returns holidays whose date is inside the inclusive range bounds', async () => {
      await db.insert(nationalHolidays).values([
        {
          date: '2026-08-03',
          name: 'A',
          is_recurring: false,
          year: 2026,
          source: 'manual' as const
        },
        {
          date: '2026-08-05',
          name: 'B',
          is_recurring: false,
          year: 2026,
          source: 'manual' as const
        },
        {
          date: '2026-08-09',
          name: 'C',
          is_recurring: false,
          year: 2026,
          source: 'manual' as const
        }
      ]);

      const res = await getHolidaysInRange('2026-08-04', '2026-08-08');
      expect(res).toEqual([{ date: '2026-08-05', name: 'B', isRecurring: false }]);
    });

    it('includes recurring holidays from either the start or end month in a cross-month range', async () => {
      await db.insert(nationalHolidays).values([
        {
          date: '1999-08-21',
          name: 'Aug 21',
          is_recurring: true,
          year: null,
          source: 'manual' as const
        },
        {
          date: '1999-09-02',
          name: 'Sep 2',
          is_recurring: true,
          year: null,
          source: 'manual' as const
        },
        {
          date: '1999-10-15',
          name: 'Oct 15',
          is_recurring: true,
          year: null,
          source: 'manual' as const
        }
      ]);

      const res = await getHolidaysInRange('2026-08-28', '2026-09-03');
      expect(res).toEqual(
        expect.arrayContaining([
          { date: '1999-08-21', name: 'Aug 21', isRecurring: true },
          { date: '1999-09-02', name: 'Sep 2', isRecurring: true }
        ])
      );
      expect(res).not.toEqual(expect.arrayContaining([{ date: '1999-10-15' }]));
    });
  });
  it('creates a national holiday record', async () => {
    const holiday = {
      date: '2026-01-01',
      name: 'New Year Day',
      description: 'National holiday for New Year',
      is_recurring: true,
      year: null,
      source: 'manual' as const,
      is_override: false
    };

    const [inserted] = await db.insert(nationalHolidays).values(holiday).returning();

    expect(inserted).toBeDefined();
    expect(inserted.date).toBe('2026-01-01');
    expect(inserted.name).toBe('New Year Day');
    expect(inserted.is_recurring).toBe(true);
    expect(inserted.year).toBeNull();
    expect(inserted.source).toBe('manual');
    expect(inserted.is_override).toBe(false);
  });

  it('enforces unique constraint on date', async () => {
    await db.insert(nationalHolidays).values({
      date: '2026-01-01',
      name: 'New Year Day',
      is_recurring: true,
      year: null,
      source: 'manual' as const,
      is_override: false
    });

    try {
      await db.insert(nationalHolidays).values({
        date: '2026-01-01',
        name: 'Another Holiday',
        is_recurring: false,
        year: 2026,
        source: 'manual' as const,
        is_override: true
      });
      // If we get here, the unique constraint didn't work
      expect(true).toBe(false); // Force test to fail
    } catch (error) {
      // Unique constraint violation should be thrown
      expect(error).toBeDefined();
    }
  });

  it('creates a non-recurring holiday with year', async () => {
    const [inserted] = await db
      .insert(nationalHolidays)
      .values({
        date: '2026-12-25',
        name: 'Company Anniversary',
        description: 'Company specific holiday',
        is_recurring: false,
        year: 2026,
        source: 'manual' as const,
        is_override: false
      })
      .returning();

    expect(inserted.year).toBe(2026);
    expect(inserted.is_recurring).toBe(false);
  });

  it('creates an imported holiday', async () => {
    const [inserted] = await db
      .insert(nationalHolidays)
      .values({
        date: '2026-08-17',
        name: 'Independence Day',
        is_recurring: true,
        year: null,
        source: 'imported' as const,
        is_override: false
      })
      .returning();

    expect(inserted.source).toBe('imported');
  });
});

describe('national holidays CRUD functions', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('getNationalHolidays returns all holidays when no year filter', async () => {
    await db.insert(nationalHolidays).values([
      {
        date: '2026-01-01',
        name: 'New Year',
        is_recurring: true,
        year: null,
        source: 'manual' as const
      },
      {
        date: '2026-12-25',
        name: 'Christmas',
        is_recurring: true,
        year: null,
        source: 'manual' as const
      }
    ]);

    const res = await getNationalHolidays();
    expect(res.success).toBe(true);
    expect(res.holidays).toHaveLength(2);
  });

  it('getNationalHolidays filters by year', async () => {
    await db.insert(nationalHolidays).values([
      {
        date: '2026-01-01',
        name: 'New Year 2026',
        is_recurring: false,
        year: 2026,
        source: 'manual' as const
      },
      {
        date: '2027-01-01',
        name: 'New Year 2027',
        is_recurring: false,
        year: 2027,
        source: 'manual' as const
      }
    ]);

    const res = await getNationalHolidays(2026);
    expect(res.success).toBe(true);
    expect(res.holidays).toHaveLength(1);
    expect(res.holidays[0].name).toBe('New Year 2026');
  });

  it('getNationalHolidays includes recurring holidays when filtering by year', async () => {
    await db.insert(nationalHolidays).values([
      {
        date: '2026-08-17',
        name: 'Independence Day',
        is_recurring: false,
        year: 2026,
        source: 'manual' as const
      },
      {
        date: '2026-12-25',
        name: 'Christmas',
        is_recurring: true,
        year: null,
        source: 'manual' as const
      }
    ]);

    const res = await getNationalHolidays(2026);
    expect(res.success).toBe(true);
    expect(res.holidays).toHaveLength(2);
    expect(res.holidays.some((h) => h.name === 'Independence Day')).toBe(true);
    expect(res.holidays.some((h) => h.name === 'Christmas')).toBe(true);
  });

  it('getNationalHoliday returns a single holiday by id', async () => {
    const [holiday] = await db
      .insert(nationalHolidays)
      .values({
        date: '2026-01-01',
        name: 'New Year',
        is_recurring: true,
        year: null,
        source: 'manual' as const
      })
      .returning();

    const res = await getNationalHoliday(holiday.id);
    expect(res.success).toBe(true);
    expect(res.holiday).toBeDefined();
    expect(res.holiday!.name).toBe('New Year');
  });

  it('getNationalHoliday returns null for non-existent id', async () => {
    const res = await getNationalHoliday(9999);
    expect(res.success).toBe(false);
    expect(res.holiday).toBeUndefined();
  });

  it('createNationalHoliday creates a new holiday', async () => {
    const input = {
      date: '2026-01-01',
      name: 'New Year',
      description: 'New Year Holiday',
      is_recurring: true,
      year: null,
      source: 'manual' as const,
      is_override: false
    };

    const res = await createNationalHoliday(input);
    expect(res.success).toBe(true);
    expect(res.holiday).toBeDefined();
    expect(res.holiday!.name).toBe('New Year');
    expect(res.holiday!.date).toBe('2026-01-01');
  });

  it('updateNationalHoliday updates an existing holiday', async () => {
    const [holiday] = await db
      .insert(nationalHolidays)
      .values({
        date: '2026-01-01',
        name: 'New Year',
        is_recurring: true,
        year: null,
        source: 'manual' as const
      })
      .returning();

    const res = await updateNationalHoliday(holiday.id, { name: 'Updated New Year' });
    expect(res.success).toBe(true);
    expect(res.holiday).toBeDefined();
    expect(res.holiday!.name).toBe('Updated New Year');
  });

  it('updateNationalHoliday returns null for non-existent holiday', async () => {
    const res = await updateNationalHoliday(9999, { name: 'Non-existent' });
    expect(res.success).toBe(false);
    expect(res.holiday).toBeUndefined();
  });

  it('deleteNationalHoliday deletes an existing holiday', async () => {
    const [holiday] = await db
      .insert(nationalHolidays)
      .values({
        date: '2026-01-01',
        name: 'New Year',
        is_recurring: true,
        year: null,
        source: 'manual' as const
      })
      .returning();

    const res = await deleteNationalHoliday(holiday.id);
    expect(res.success).toBe(true);

    const checkRes = await getNationalHoliday(holiday.id);
    expect(checkRes.success).toBe(false);
  });
});

describe('shift master CRUD (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  it('createSchedule writes the shift with shift-wide fields and defaults tolerance to 5/120', async () => {
    const res = await createSchedule({
      name: 'Morning',
      startTime: '08:00',
      endTime: '17:00',
      color: '#ff0000',
      breakStart: '12:00',
      breakEnd: '13:00',
      maxBreakMinutes: 60,
      note: 'with break'
    });

    expect(res.success).toBe(true);
    if (!res.success || !res.shift) throw new Error('createSchedule failed');
    expect(res.shift).toMatchObject({
      name: 'Morning',
      late_tolerance_minutes: 5,
      absence_cutoff_minutes: 120,
      color: '#ff0000',
      break_start: '12:00',
      break_end: '13:00',
      max_break_minutes: 60,
      note: 'with break',
      status: 'active'
    });
  });

  it('createSchedule auto-generates Mon-Fri weekday rules when none supplied', async () => {
    const res = await createSchedule({
      name: 'Auto',
      startTime: '08:00',
      endTime: '17:00'
    });
    if (!res.success || !res.shift) throw new Error('createSchedule failed');

    const rulesRes = await getShiftWeekdayRules(res.shift.id);
    expect(rulesRes.rules).toHaveLength(7);
    const workingDays = rulesRes.rules
      .filter((r) => r.is_working_day)
      .map((r) => r.day_of_week)
      .sort();
    expect(workingDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('createSchedule accepts explicit weekdayRules and respects isWorkingDay=false', async () => {
    const res = await createSchedule({
      name: 'Custom',
      startTime: '08:00',
      endTime: '16:00',
      weekdayRules: [
        { dayOfWeek: 0, isWorkingDay: false },
        { dayOfWeek: 6, isWorkingDay: false }
      ]
    });
    if (!res.success || !res.shift) throw new Error('createSchedule failed');
    const rulesRes = await getShiftWeekdayRules(res.shift.id);
    const offDays = rulesRes.rules
      .filter((r) => !r.is_working_day)
      .map((r) => r.day_of_week)
      .sort();
    expect(offDays).toEqual([0, 6]);
  });

  it('updateSchedule replaces weekday rules atomically with the new ones', async () => {
    const created = await createSchedule({
      name: 'Update me',
      startTime: '08:00',
      endTime: '17:00'
    });
    if (!created.success || !created.shift) throw new Error('seed failed');

    const newRules = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 6,
      startTime: '09:00',
      endTime: '18:00'
    }));

    const res = await updateSchedule(created.shift.id, {
      name: 'Updated',
      color: '#00ff00',
      weekdayRules: newRules
    });
    expect(res.success).toBe(true);

    const { shifts } = await import('./schema/attendance');
    const [after] = await db.select().from(shifts).where(eq(shifts.id, created.shift.id));
    expect(after.name).toBe('Updated');
    expect(after.color).toBe('#00ff00');

    const rulesRes = await getShiftWeekdayRules(created.shift.id);
    expect(rulesRes.rules).toHaveLength(7);
    expect(rulesRes.rules.find((r) => r.day_of_week === 6)?.is_working_day).toBe(true);
    expect(rulesRes.rules.every((r) => r.start_time === '09:00')).toBe(true);
  });

  it('updateSchedule writes shift-level tolerance overrides and accepts status toggle', async () => {
    const created = await createSchedule({
      name: 'Policy',
      startTime: '08:00',
      endTime: '17:00'
    });
    if (!created.success || !created.shift) throw new Error('seed failed');

    const res = await updateSchedule(created.shift.id, {
      lateToleranceMinutes: 10,
      absenceCutoffMinutes: 90,
      status: 'inactive'
    });
    expect(res.success).toBe(true);

    const { shifts } = await import('./schema/attendance');
    const [after] = await db.select().from(shifts).where(eq(shifts.id, created.shift.id));
    expect(after.late_tolerance_minutes).toBe(10);
    expect(after.absence_cutoff_minutes).toBe(90);
    expect(after.status).toBe('inactive');
  });

  it('listShifts returns all shifts (incl inactive) with used=false when unused', async () => {
    await createSchedule({ name: 'S1', startTime: '08:00', endTime: '17:00' });
    await createSchedule({ name: 'S2', startTime: '09:00', endTime: '18:00' });
    const created = await createSchedule({
      name: 'Inactive',
      startTime: '08:00',
      endTime: '17:00'
    });
    if (!created.success || !created.shift) throw new Error('seed failed');
    await updateSchedule(created.shift.id, { status: 'inactive' });

    const res = await listShifts();
    expect(res.success).toBe(true);
    if (!res.success) throw new Error('list failed');
    expect(res.shifts.map((s) => s.name).sort()).toEqual(['Inactive', 'S1', 'S2']);
    expect(res.shifts.every((s) => s.used === false)).toBe(true);
  });

  it('listShifts marks used=true when referenced by schedule_assignments', async () => {
    const created = await createSchedule({ name: 'Used', startTime: '08:00', endTime: '17:00' });
    if (!created.success || !created.shift) throw new Error('seed failed');
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: created.shift.id,
      effective_from: '2026-01-01'
    });

    const res = await listShifts();
    if (!res.success) throw new Error('list failed');
    const used = res.shifts.find((s) => s.id === created.shift.id);
    expect(used?.used).toBe(true);
  });

  it('listShifts marks used=true when referenced by employee_shifts (attendance)', async () => {
    const created = await createSchedule({
      name: 'AttendanceRef',
      startTime: '08:00',
      endTime: '17:00'
    });
    if (!created.success || !created.shift) throw new Error('seed failed');
    await seedEmployee(TEST_USER_ID);
    await db.insert(employeeShifts).values({
      user_id: TEST_USER_ID,
      shift_id: created.shift.id,
      date: '2026-01-15',
      attendance_status: 'pending'
    });

    const res = await listShifts();
    if (!res.success) throw new Error('list failed');
    const used = res.shifts.find((s) => s.id === created.shift.id);
    expect(used?.used).toBe(true);
  });

  it('listShifts marks used=true when referenced by daily_checklists (snapshot)', async () => {
    const created = await createSchedule({
      name: 'ChecklistRef',
      startTime: '08:00',
      endTime: '17:00'
    });
    if (!created.success || !created.shift) throw new Error('seed failed');
    const { seedUser } = await import('@/test-utils/db');
    await seedUser(TEST_USER_ID);
    const { dailyChecklists } = await import('./schema/checklists');
    await db.insert(dailyChecklists).values({
      user_id: TEST_USER_ID,
      checklist_date: '2026-08-03',
      shift_id: created.shift.id
    });

    const res = await listShifts();
    if (!res.success) throw new Error('list failed');
    const used = res.shifts.find((s) => s.id === created.shift.id);
    expect(used?.used).toBe(true);
  });

  it('deleteShift hard-deletes a shift that has no references', async () => {
    const created = await createSchedule({ name: 'Orphan', startTime: '08:00', endTime: '17:00' });
    if (!created.success || !created.shift) throw new Error('seed failed');

    const res = await deleteShift(created.shift.id);
    expect(res).toMatchObject({ success: true, mode: 'hard', shiftId: created.shift.id });

    const { shifts } = await import('./schema/attendance');
    const rows = await db.select().from(shifts).where(eq(shifts.id, created.shift.id));
    expect(rows).toHaveLength(0);

    const rulesRes = await getShiftWeekdayRules(created.shift.id);
    expect(rulesRes.rules).toHaveLength(0);
  });

  it('deleteShift soft-deletes (status=inactive) when shift has schedule assignments', async () => {
    const created = await createSchedule({ name: 'InUse', startTime: '08:00', endTime: '17:00' });
    if (!created.success || !created.shift) throw new Error('seed failed');
    await seedScheduleAssignment({
      user_id: TEST_USER_ID,
      shift_id: created.shift.id,
      effective_from: '2026-01-01'
    });

    const res = await deleteShift(created.shift.id);
    expect(res).toMatchObject({ success: true, mode: 'soft', shiftId: created.shift.id });

    const { shifts } = await import('./schema/attendance');
    const [after] = await db.select().from(shifts).where(eq(shifts.id, created.shift.id));
    expect(after.status).toBe('inactive');
    const { scheduleAssignments } = await import('./schema/attendance');
    const [assignment] = await db
      .select()
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.shift_id, created.shift.id));
    expect(assignment).toBeDefined();
  });

  it('deleteShift soft-deletes when shift is referenced by employee_shifts (attendance history)', async () => {
    const created = await createSchedule({ name: 'AttHist', startTime: '08:00', endTime: '17:00' });
    if (!created.success || !created.shift) throw new Error('seed failed');
    await seedEmployee(TEST_USER_ID);
    await db.insert(employeeShifts).values({
      user_id: TEST_USER_ID,
      shift_id: created.shift.id,
      date: '2026-01-15',
      attendance_status: 'pending'
    });

    const res = await deleteShift(created.shift.id);
    expect(res).toMatchObject({ success: true, mode: 'soft' });

    const { shifts } = await import('./schema/attendance');
    const [after] = await db.select().from(shifts).where(eq(shifts.id, created.shift.id));
    expect(after.status).toBe('inactive');
  });

  it('deleteShift soft-deletes when shift is referenced by daily_checklists (snapshot)', async () => {
    const created = await createSchedule({
      name: 'ChecklistHist',
      startTime: '08:00',
      endTime: '17:00'
    });
    if (!created.success || !created.shift) throw new Error('seed failed');
    const { seedUser } = await import('@/test-utils/db');
    await seedUser(TEST_USER_ID);
    const { dailyChecklists } = await import('./schema/checklists');
    await db.insert(dailyChecklists).values({
      user_id: TEST_USER_ID,
      checklist_date: '2026-08-03',
      shift_id: created.shift.id
    });

    const res = await deleteShift(created.shift.id);
    expect(res).toMatchObject({ success: true, mode: 'soft' });

    const { shifts } = await import('./schema/attendance');
    const [after] = await db.select().from(shifts).where(eq(shifts.id, created.shift.id));
    expect(after.status).toBe('inactive');
  });

  it('deleteShift returns not_found for non-existent id', async () => {
    const res = await deleteShift(999999);
    expect(res).toMatchObject({ success: false, reason: 'not_found' });
  });

  it('shift-level tolerance (set via createSchedule) flows through getEffectiveEmployeeSchedule (ADR-0004)', async () => {
    // Regression for ticket02 P0: getEffectiveEmployeeSchedule previously read
    // tolerance from shift_weekday_rules (now deprecated). New shifts must
    // round-trip their tolerance from the shift row.
    const created = await createSchedule({
      name: 'CustomTolerance',
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 7,
      absenceCutoffMinutes: 75
    });
    if (!created.success || !created.shift) throw new Error('seed failed');
    // createSchedule already seeded all 7 default weekday rules (Mon–Fri
    // working, Sat–Sun off, all with the shift's start/end). Don't re-insert.
    await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: created.shift.id });

    const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
    expect(res).not.toBeNull();
    expect(res!.lateToleranceMinutes).toBe(7);
    expect(res!.absenceCutoffMinutes).toBe(75);
  });
});

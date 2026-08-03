import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  calculateDistance,
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
  getShiftWeekdayRules,
  createScheduleAssignment,
  createDayOff,
  createAttendanceCorrection,
  checkIn
} from './attendance';
import {
  resetAllTables,
  seedLocation,
  seedShift,
  seedShiftWeekdayRule,
  seedScheduleAssignment,
  seedDateOverride,
  seedDayOff,
  seedAttendanceCorrection
} from '@/test-utils/db';
import { db } from '@/lib/db';
import { employeeShifts, performanceReports } from './schema/attendance';

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
      const shift = await seedShift({ name: 'Morning' });
      await seedShiftWeekdayRule(shift.id, {
        day_of_week: 1, // Monday
        start_time: '08:00',
        end_time: '17:00',
        late_tolerance_minutes: 10,
        absence_cutoff_minutes: 120
      });
      await seedScheduleAssignment({ user_id: TEST_USER_ID, shift_id: shift.id });

      const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-08-03');
      expect(res).not.toBeNull();
      expect(res!.shiftId).toBe(shift.id);
      expect(res!.startTime).toBe('08:00');
      expect(res!.endTime).toBe('17:00');
      expect(res!.lateToleranceMinutes).toBe(10);
      expect(res!.absenceCutoffMinutes).toBe(120);
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
      const res = await createAttendanceCorrection({
        attendanceId: 1,
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
      day_of_week: 1,
      is_working_day: true,
      start_time: '00:00',
      end_time: '23:59',
      late_tolerance_minutes: 0,
      absence_cutoff_minutes: 120
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
    const shift = await seedActiveSchedule();
    await seedShiftWeekdayRule(shift.id, {
      day_of_week: 1,
      is_working_day: true,
      start_time: '00:00',
      end_time: '23:59'
    });
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
    const shift = await seedActiveSchedule();
    await seedShiftWeekdayRule(shift.id, {
      day_of_week: 1,
      is_working_day: true,
      start_time: '00:00',
      end_time: '23:59'
    });
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
    const shift = await seedActiveSchedule();
    await seedShiftWeekdayRule(shift.id, {
      day_of_week: 1,
      is_working_day: true,
      start_time: '00:00',
      end_time: '23:59'
    });
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
    const shift = await seedActiveSchedule();
    await seedShiftWeekdayRule(shift.id, {
      day_of_week: 1,
      is_working_day: true,
      start_time: '00:00',
      end_time: '23:59'
    });
    await seedLocation({ gps_validation_enabled: true });

    const res = await checkIn(TEST_USER_ID, {});
    expect(res.success).toBe(false);
  });
});

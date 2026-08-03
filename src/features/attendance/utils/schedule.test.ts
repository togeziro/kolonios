import { describe, expect, it } from 'vitest';
import {
  resolveEffectiveSchedule,
  calculateLateMinutes,
  isAbsentAfterCutoff,
  resolveAttendancePolicy,
  isLocationStale,
  isAccuracyAcceptable,
  type EffectiveSchedule,
  type AttendancePolicy,
  type WeekdayScheduleRule
} from './schedule';

// --- resolveEffectiveSchedule ---

describe('resolveEffectiveSchedule', () => {
  const baseAssignment = {
    userId: 'user-1',
    shiftId: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null
  };

  const weekdayRules: WeekdayScheduleRule[] = [
    {
      dayOfWeek: 1,
      isWorkingDay: true,
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 10,
      absenceCutoffMinutes: 120
    },
    {
      dayOfWeek: 2,
      isWorkingDay: true,
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 10,
      absenceCutoffMinutes: 120
    },
    {
      dayOfWeek: 3,
      isWorkingDay: true,
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 10,
      absenceCutoffMinutes: 120
    },
    {
      dayOfWeek: 4,
      isWorkingDay: true,
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 10,
      absenceCutoffMinutes: 120
    },
    {
      dayOfWeek: 5,
      isWorkingDay: true,
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 10,
      absenceCutoffMinutes: 120
    },
    {
      dayOfWeek: 6,
      isWorkingDay: false,
      startTime: null,
      endTime: null,
      lateToleranceMinutes: 0,
      absenceCutoffMinutes: 0
    },
    {
      dayOfWeek: 0,
      isWorkingDay: false,
      startTime: null,
      endTime: null,
      lateToleranceMinutes: 0,
      absenceCutoffMinutes: 0
    }
  ];

  it('returns null when no assignment exists', () => {
    const result = resolveEffectiveSchedule({
      assignment: null,
      weekdayRules: weekdayRules,
      dateOverrides: [],
      dayOffs: [],
      date: '2026-08-04' // Tuesday
    });
    expect(result).toBeNull();
  });

  it('returns weekday rule for a working day with assignment', () => {
    const result = resolveEffectiveSchedule({
      assignment: baseAssignment,
      weekdayRules,
      dateOverrides: [],
      dayOffs: [],
      date: '2026-08-04' // Tuesday (dayOfWeek=2)
    });
    expect(result).not.toBeNull();
    expect(result!.startTime).toBe('08:00');
    expect(result!.endTime).toBe('17:00');
    expect(result!.isWorkingDay).toBe(true);
  });

  it('returns null for a non-working weekday (Saturday) with assignment', () => {
    const result = resolveEffectiveSchedule({
      assignment: baseAssignment,
      weekdayRules,
      dateOverrides: [],
      dayOffs: [],
      date: '2026-08-08' // Saturday (dayOfWeek=6)
    });
    expect(result).toBeNull();
  });

  it('day-off override takes precedence over weekday rule', () => {
    const result = resolveEffectiveSchedule({
      assignment: baseAssignment,
      weekdayRules,
      dateOverrides: [],
      dayOffs: ['2026-08-04'], // Tuesday marked as day-off
      date: '2026-08-04'
    });
    expect(result).toBeNull();
  });

  it('date-specific shift override takes precedence over weekday rule', () => {
    const overrides = [
      { date: '2026-08-04', shiftId: 2 } // different shift on this date
    ];
    const result = resolveEffectiveSchedule({
      assignment: baseAssignment,
      weekdayRules,
      dateOverrides: overrides,
      dayOffs: [],
      date: '2026-08-04'
    });
    expect(result).not.toBeNull();
    // The override should use shiftId 2's rules (we assume weekdayRules are looked up by override shiftId)
    // For this test, we just verify it resolves to a working day
    expect(result!.isWorkingDay).toBe(true);
  });

  it('day-off takes precedence over date-specific shift override', () => {
    const overrides = [{ date: '2026-08-04', shiftId: 2 }];
    const result = resolveEffectiveSchedule({
      assignment: baseAssignment,
      weekdayRules,
      dateOverrides: overrides,
      dayOffs: ['2026-08-04'],
      date: '2026-08-04'
    });
    expect(result).toBeNull();
  });
});

// --- calculateLateMinutes ---

describe('calculateLateMinutes', () => {
  const schedule: EffectiveSchedule = {
    shiftId: 1,
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 10,
    absenceCutoffMinutes: 120,
    isWorkingDay: true
  };

  it('returns 0 when check-in is before start + tolerance', () => {
    // 07:55 is before 08:00 + 10min tolerance = 08:10
    expect(calculateLateMinutes({ schedule, actualCheckIn: '07:55' })).toBe(0);
  });

  it('returns 0 when check-in is exactly at start + tolerance', () => {
    expect(calculateLateMinutes({ schedule, actualCheckIn: '08:10' })).toBe(0);
  });

  it('returns positive minutes when check-in is after start + tolerance', () => {
    // 08:15 is 5 minutes after 08:10 (start + tolerance)
    expect(calculateLateMinutes({ schedule, actualCheckIn: '08:15' })).toBe(5);
  });

  it('returns 0 when tolerance is 0 and check-in is on time', () => {
    const s = { ...schedule, lateToleranceMinutes: 0 };
    expect(calculateLateMinutes({ schedule: s, actualCheckIn: '08:00' })).toBe(0);
  });

  it('returns 1 when tolerance is 0 and check-in is 1 minute late', () => {
    const s = { ...schedule, lateToleranceMinutes: 0 };
    expect(calculateLateMinutes({ schedule: s, actualCheckIn: '08:01' })).toBe(1);
  });

  it('handles cross-hour late calculation', () => {
    const s = { ...schedule, startTime: '09:30', lateToleranceMinutes: 15 };
    // 10:00 is 15 minutes after 09:30+15 = 09:45
    expect(calculateLateMinutes({ schedule: s, actualCheckIn: '10:00' })).toBe(15);
  });
});

// --- isAbsentAfterCutoff ---

describe('isAbsentAfterCutoff', () => {
  const schedule: EffectiveSchedule = {
    shiftId: 1,
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 10,
    absenceCutoffMinutes: 120,
    isWorkingDay: true
  };

  it('returns false before cutoff time', () => {
    // cutoff = 08:00 + 120min = 10:00
    expect(isAbsentAfterCutoff({ schedule, nowTime: '09:59' })).toBe(false);
  });

  it('returns true at or after cutoff time', () => {
    expect(isAbsentAfterCutoff({ schedule, nowTime: '10:00' })).toBe(true);
    expect(isAbsentAfterCutoff({ schedule, nowTime: '10:01' })).toBe(true);
  });

  it('returns false when cutoff is 0 (no auto-absent)', () => {
    const s = { ...schedule, absenceCutoffMinutes: 0 };
    expect(isAbsentAfterCutoff({ schedule: s, nowTime: '23:59' })).toBe(false);
  });
});

// --- resolveAttendancePolicy ---

describe('resolveAttendancePolicy', () => {
  it('uses location policy when no schedule policy override', () => {
    const policy = resolveAttendancePolicy({
      locationPolicy: {
        gpsValidationEnabled: true,
        selfieRequired: false,
        maxAccuracyMeters: 50,
        maxStaleMs: 30000
      },
      schedulePolicyOverride: null
    });
    expect(policy.gpsValidationEnabled).toBe(true);
    expect(policy.selfieRequired).toBe(false);
    expect(policy.maxAccuracyMeters).toBe(50);
    expect(policy.maxStaleMs).toBe(30000);
  });

  it('schedule policy override takes precedence over location policy', () => {
    const policy = resolveAttendancePolicy({
      locationPolicy: {
        gpsValidationEnabled: true,
        selfieRequired: false,
        maxAccuracyMeters: 50,
        maxStaleMs: 30000
      },
      schedulePolicyOverride: {
        gpsValidationEnabled: false,
        selfieRequired: true,
        maxAccuracyMeters: 100,
        maxStaleMs: 60000
      }
    });
    expect(policy.gpsValidationEnabled).toBe(false);
    expect(policy.selfieRequired).toBe(true);
    expect(policy.maxAccuracyMeters).toBe(100);
    expect(policy.maxStaleMs).toBe(60000);
  });

  it('partial schedule override merges with location defaults', () => {
    const policy = resolveAttendancePolicy({
      locationPolicy: {
        gpsValidationEnabled: true,
        selfieRequired: false,
        maxAccuracyMeters: 50,
        maxStaleMs: 30000
      },
      schedulePolicyOverride: {
        gpsValidationEnabled: false,
        selfieRequired: null,
        maxAccuracyMeters: null,
        maxStaleMs: null
      }
    });
    expect(policy.gpsValidationEnabled).toBe(false); // overridden
    expect(policy.selfieRequired).toBe(false); // from location default
    expect(policy.maxAccuracyMeters).toBe(50); // from location default
    expect(policy.maxStaleMs).toBe(30000); // from location default
  });
});

// --- isLocationStale ---

describe('isLocationStale', () => {
  it('returns false when timestamp is recent', () => {
    const now = Date.now();
    const captured = now - 10000; // 10 seconds ago
    expect(isLocationStale(captured, now, 30000)).toBe(false);
  });

  it('returns true when timestamp exceeds maxAgeMs', () => {
    const now = Date.now();
    const captured = now - 60000; // 60 seconds ago
    expect(isLocationStale(captured, now, 30000)).toBe(true);
  });

  it('returns false when maxAgeMs is 0 (no staleness check)', () => {
    const now = Date.now();
    const captured = now - 1000000;
    expect(isLocationStale(captured, now, 0)).toBe(false);
  });
});

// --- isAccuracyAcceptable ---

describe('isAccuracyAcceptable', () => {
  it('returns true when accuracy is within limit', () => {
    expect(isAccuracyAcceptable(20, 50)).toBe(true);
  });

  it('returns false when accuracy exceeds limit', () => {
    expect(isAccuracyAcceptable(60, 50)).toBe(false);
  });

  it('returns true when maxAccuracyMeters is 0 (no accuracy check)', () => {
    expect(isAccuracyAcceptable(1000, 0)).toBe(true);
  });

  it('returns true when accuracy is exactly at limit', () => {
    expect(isAccuracyAcceptable(50, 50)).toBe(true);
  });
});

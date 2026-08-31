/**
 * Pure domain utilities for attendance scheduling, late/absence calculation,
 * and policy resolution. All functions are pure: explicit inputs, no globals,
 * no Date.now(), no DB, no browser APIs.
 */

// --- Types ---

export type WeekdayScheduleRule = {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  isWorkingDay: boolean;
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
};

// ADR-0004: tolerance is shift-wide; passed alongside the per-day rules.
export type ShiftPolicy = {
  shiftId: number;
  lateToleranceMinutes: number;
  absenceCutoffMinutes: number;
};

export const DEFAULT_SHIFT_POLICY: ShiftPolicy = {
  shiftId: -1,
  lateToleranceMinutes: 5,
  absenceCutoffMinutes: 120
};

export type ScheduleAssignment = {
  userId: string;
  shiftId: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // YYYY-MM-DD | null = indefinite
};

export type DateOverride = {
  date: string; // YYYY-MM-DD
  shiftId: number;
};

export type AttendancePolicy = {
  gpsValidationEnabled: boolean;
  selfieRequired: boolean;
  maxAccuracyMeters: number;
  maxStaleMs: number;
};

export type LocationPolicy = {
  gpsValidationEnabled: boolean;
  selfieRequired: boolean;
  maxAccuracyMeters: number;
  maxStaleMs: number;
};

export type SchedulePolicyOverride = {
  gpsValidationEnabled: boolean | null;
  selfieRequired: boolean | null;
  maxAccuracyMeters: number | null;
  maxStaleMs: number | null;
};

export type EffectiveSchedule = {
  shiftId: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  lateToleranceMinutes: number;
  absenceCutoffMinutes: number;
  isWorkingDay: true;
};

// --- Helpers ---

function parseTime(time: string): number {
  // Accepts HH:MM or HH:MM:SS, returns minutes since midnight
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function dayOfWeekFromDate(dateStr: string): number {
  // dateStr: YYYY-MM-DD
  // Returns 0=Sun, 1=Mon, ..., 6=Sat
  const [y, m, d] = dateStr.split('-').map(Number);
  // Use local date constructor to avoid UTC offset issues
  return new Date(y, m - 1, d).getDay();
}

// --- resolveEffectiveSchedule ---

export function resolveEffectiveSchedule(input: {
  assignment: ScheduleAssignment | null;
  weekdayRules: WeekdayScheduleRule[];
  shiftPolicies?: ShiftPolicy[];
  dateOverrides: DateOverride[];
  dayOffs: string[]; // dates as YYYY-MM-DD
  date: string; // YYYY-MM-DD
}): EffectiveSchedule | null {
  const { assignment, weekdayRules, shiftPolicies, dateOverrides, dayOffs, date } = input;
  const policies = shiftPolicies ?? [];

  if (!assignment) return null;

  // Day-off takes precedence
  if (dayOffs.includes(date)) return null;

  // Date-specific override (shift override)
  const override = dateOverrides.find((o) => o.date === date);
  const effectiveShiftId = override ? override.shiftId : assignment.shiftId;

  // Find weekday rule for this date
  const dow = dayOfWeekFromDate(date);
  const rule = weekdayRules.find((r) => r.dayOfWeek === dow);
  if (!rule) return null;
  if (!rule.isWorkingDay) return null;

  // Pick the shift's policy (ADR-0004). Fall back to default if missing.
  const policy = policies.find((p) => p.shiftId === effectiveShiftId) ?? {
    ...DEFAULT_SHIFT_POLICY,
    shiftId: effectiveShiftId
  };

  return {
    shiftId: effectiveShiftId,
    startTime: rule.startTime!,
    endTime: rule.endTime!,
    lateToleranceMinutes: policy.lateToleranceMinutes,
    absenceCutoffMinutes: policy.absenceCutoffMinutes,
    isWorkingDay: true
  };
}

// --- calculateLateMinutes ---

export function calculateLateMinutes(input: {
  schedule: EffectiveSchedule;
  actualCheckIn: string; // HH:MM or HH:MM:SS
}): number {
  const { schedule, actualCheckIn } = input;
  const start = parseTime(schedule.startTime);
  const checkIn = parseTime(actualCheckIn);
  const cutoff = start + schedule.lateToleranceMinutes;

  if (checkIn <= cutoff) return 0;
  return checkIn - cutoff;
}

// --- isAbsentAfterCutoff ---

export function isAbsentAfterCutoff(input: {
  schedule: EffectiveSchedule;
  nowTime: string; // HH:MM or HH:MM:SS
}): boolean {
  const { schedule, nowTime } = input;
  if (schedule.absenceCutoffMinutes <= 0) return false;

  const start = parseTime(schedule.startTime);
  const cutoff = start + schedule.absenceCutoffMinutes;
  const now = parseTime(nowTime);

  return now >= cutoff;
}

// --- resolveAttendancePolicy ---

export function resolveAttendancePolicy(input: {
  locationPolicy: LocationPolicy;
  schedulePolicyOverride: SchedulePolicyOverride | null;
}): AttendancePolicy {
  const { locationPolicy, schedulePolicyOverride } = input;

  if (!schedulePolicyOverride) return { ...locationPolicy };

  return {
    gpsValidationEnabled:
      schedulePolicyOverride.gpsValidationEnabled ?? locationPolicy.gpsValidationEnabled,
    selfieRequired: schedulePolicyOverride.selfieRequired ?? locationPolicy.selfieRequired,
    maxAccuracyMeters: schedulePolicyOverride.maxAccuracyMeters ?? locationPolicy.maxAccuracyMeters,
    maxStaleMs: schedulePolicyOverride.maxStaleMs ?? locationPolicy.maxStaleMs
  };
}

// --- isLocationStale ---

export function isLocationStale(timestamp: number, now: number, maxAgeMs: number): boolean {
  if (maxAgeMs <= 0) return false;
  return now - timestamp > maxAgeMs;
}

// --- isAccuracyAcceptable ---

export function isAccuracyAcceptable(accuracy: number, maxAccuracyMeters: number): boolean {
  if (maxAccuracyMeters <= 0) return true;
  return accuracy <= maxAccuracyMeters;
}

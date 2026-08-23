export {
  resolveEffectiveSchedule,
  calculateLateMinutes,
  isAbsentAfterCutoff,
  resolveAttendancePolicy,
  isLocationStale,
  isAccuracyAcceptable
} from '@/lib/attendance/schedule';

export type {
  WeekdayScheduleRule,
  ScheduleAssignment,
  DateOverride,
  AttendancePolicy,
  LocationPolicy,
  SchedulePolicyOverride,
  EffectiveSchedule
} from '@/lib/attendance/schedule';

import type {
  employeeShifts,
  locations,
  shifts,
  leaves,
  performanceReports
} from '@/lib/db/schema/attendance';

export type EmployeeShift = typeof employeeShifts.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type Leave = typeof leaves.$inferSelect;
export type PerformanceReport = typeof performanceReports.$inferSelect;

export type ShiftType = 'fixed' | 'flexible';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'pending';

export type LeaveType = 'annual' | 'sick' | 'personal' | 'emergency' | 'maternity' | 'paternity';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// --- Schedule and policy types ---

export type WeekdayScheduleRule = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  lateToleranceMinutes: number;
  absenceCutoffMinutes: number;
};

export type ScheduleAssignment = {
  userId: string;
  shiftId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type DateOverride = {
  date: string;
  shiftId: number;
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

export type AttendancePolicy = {
  gpsValidationEnabled: boolean;
  selfieRequired: boolean;
  maxAccuracyMeters: number;
  maxStaleMs: number;
};

export type EffectiveSchedule = {
  shiftId: number;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  absenceCutoffMinutes: number;
  isWorkingDay: true;
};

export type AttendanceCheckInPayload = {
  shiftId?: number;
  locationId?: number;
  latitude?: number;
  longitude?: number;
  lateDuration?: number;
  photo?: string;
  note?: string;
};

export type AttendanceCheckOutPayload = {
  attendanceId: number;
  latitude?: number;
  longitude?: number;
  earlyOutDuration?: number;
  photo?: string;
  note?: string;
};

export type AttendanceFilters = {
  page?: number;
  limit?: number;
  month?: number;
  year?: number;
  status?: string;
};

export type AttendanceHistoryResponse = {
  success: boolean;
  time?: string;
  message?: string;
  total?: number;
  offset?: number;
  limit?: number;
  records?: {
    attendance: EmployeeShift;
    shift: Shift | null;
    location: Location | null;
  }[];
};

export type LeaveRequestPayload = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  file?: string;
};

export type LeaveFilters = {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  leaveType?: LeaveType;
};

export type AssignmentFilters = {
  page?: number;
  limit?: number;
  userId?: string;
  shiftId?: number;
};

export type LeaveListResponse = {
  success: boolean;
  time?: string;
  message?: string;
  total?: number;
  offset?: number;
  limit?: number;
  leaves?: Leave[];
};

export type PerformanceStatsResponse = {
  success: boolean;
  time?: string;
  message?: string;
  reports?: PerformanceReport[];
};

export type AttendanceSummary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  month: string;
};

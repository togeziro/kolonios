import type {
  employeeShifts,
  locations,
  shifts,
  leaves,
  performanceReports
} from '@/lib/db/schema/attendance';

export type {
  WeekdayScheduleRule,
  ScheduleAssignment,
  DateOverride,
  AttendancePolicy,
  LocationPolicy,
  SchedulePolicyOverride,
  EffectiveSchedule
} from '@/lib/attendance/schedule';

export type EmployeeShift = typeof employeeShifts.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type Leave = typeof leaves.$inferSelect;
export type PerformanceReport = typeof performanceReports.$inferSelect;

export type ShiftType = 'fixed' | 'flexible';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'pending';

export type LeaveType = 'annual' | 'sick' | 'personal' | 'emergency' | 'maternity' | 'paternity';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type AttendanceCheckInPayload = {
  shiftId?: number;
  locationId?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: number;
  lateDuration?: number;
  photo?: string;
  note?: string;
};

export type AttendanceCheckOutPayload = {
  attendanceId: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: number;
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

export type AdminAttendanceFilters = {
  page?: number;
  limit?: number;
  userId?: string;
  departmentId?: number;
  locationId?: number;
  shiftId?: number;
  status?: AttendanceStatus;
  startDate?: string;
  endDate?: string;
};

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type ExportResponse = {
  success: boolean;
  format?: ExportFormat;
  content?: string;
  mime?: string;
  ext?: string;
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

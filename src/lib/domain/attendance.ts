import type {
  employeeShifts,
  locations,
  shifts,
  leaves,
  performanceReports
} from '@/lib/db/schema/attendance';

export type {
  AttendancePolicy,
  LocationPolicy,
  EffectiveSchedule
} from '@/lib/attendance/schedule';

export type EmployeeShift = typeof employeeShifts.$inferSelect;
type Location = typeof locations.$inferSelect;
type Shift = typeof shifts.$inferSelect;
type Leave = typeof leaves.$inferSelect;
type PerformanceReport = typeof performanceReports.$inferSelect;

export type LeaveType = 'annual' | 'sick' | 'personal' | 'emergency' | 'maternity' | 'paternity';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'pending';

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
  // Set by the caller after a successful server-side verifyFaceFn call.
  // Locations that relax face verification allow check-in without it.
  faceVerified?: boolean;
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

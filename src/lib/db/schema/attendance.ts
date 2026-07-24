import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  real
} from 'drizzle-orm/pg-core';

/**
 * Attendance Module Database Schema
 * All column names use English for consistency with international codebase.
 */

// Enums
export const shiftTypeEnum = pgEnum('shift_type', ['fixed', 'flexible']);
export const shiftStatusEnum = pgEnum('shift_status', ['active', 'inactive']);
export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'late',
  'absent',
  'excused',
  'pending'
]);
export const leaveTypeEnum = pgEnum('leave_type', [
  'annual',
  'sick',
  'personal',
  'emergency',
  'maternity',
  'paternity'
]);
export const leaveStatusEnum = pgEnum('leave_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled'
]);

// locations table
export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  location_name: text('location_name').notNull(),
  company_latitude: real('company_latitude'),
  company_longitude: real('company_longitude'),
  radius: real('radius').default(100),
  description: text('description'),
  status: text('status').default('active'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// shifts table
export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  shift_name: text('shift_name').notNull(),
  check_in_time: text('check_in_time').notNull(), // HH:MM format
  check_out_time: text('check_out_time').notNull(), // HH:MM format
  type: shiftTypeEnum('type').default('fixed'),
  status: shiftStatusEnum('status').default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// employee_shifts table
export const employeeShifts = pgTable('employee_shifts', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  shift_id: integer('shift_id'),
  date: text('date').notNull(), // YYYY-MM-DD
  check_in_time_actual: text('check_in_time_actual'),
  minutes_late: real('minutes_late'),
  check_in_latitude: real('check_in_latitude'),
  check_in_longitude: real('check_in_longitude'),
  check_in_distance_meters: real('check_in_distance_meters'),
  check_in_photo_url: text('check_in_photo_url'),
  check_in_note: text('check_in_note'),
  check_out_time_actual: text('check_out_time_actual'),
  minutes_early: real('minutes_early'),
  check_out_latitude: real('check_out_latitude'),
  check_out_longitude: real('check_out_longitude'),
  check_out_distance_meters: real('check_out_distance_meters'),
  check_out_photo_url: text('check_out_photo_url'),
  check_out_note: text('check_out_note'),
  attendance_status: text('attendance_status'),
  geo_fence_enabled: integer('geo_fence_enabled').default(1),
  approved_check_in_time: text('approved_check_in_time'),
  approved_check_out_time: text('approved_check_out_time'),
  description: text('description'),
  approval_status: leaveStatusEnum('approval_status'),
  supporting_document_url: text('supporting_document_url'),
  comments: text('comments'),
  approved_by: text('approved_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// leaves table
export const leaves = pgTable('leaves', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  shift_id: integer('shift_id'),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  total_days: real('total_days').notNull(),
  leave_type: leaveTypeEnum('leave_type').notNull(),
  reason: text('reason'),
  supporting_document_url: text('supporting_document_url'),
  status: leaveStatusEnum('status').default('pending'),
  approved_by: text('approved_by'),
  approved_at: text('approved_at'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// performance_reports table
export const performanceReports = pgTable('performance_reports', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  report_date: text('report_date').notNull(),
  performance_type_id: integer('performance_type_id'),
  score: numeric('score', { precision: 10, scale: 2 }),
  running_score: numeric('running_score', { precision: 10, scale: 2 }),
  reference: text('reference'),
  reference_id: text('reference_id'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;

export type EmployeeShift = typeof employeeShifts.$inferSelect;
export type NewEmployeeShift = typeof employeeShifts.$inferInsert;

export type Leave = typeof leaves.$inferSelect;
export type NewLeave = typeof leaves.$inferInsert;

export type PerformanceReport = typeof performanceReports.$inferSelect;
export type NewPerformanceReport = typeof performanceReports.$inferInsert;

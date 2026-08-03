import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  integer,
  real,
  boolean
} from 'drizzle-orm/pg-core';

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

export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  radius: real('radius').default(100),
  description: text('description'),
  status: text('status').default('active'),
  // Policy columns
  gps_validation_enabled: boolean('gps_validation_enabled').default(true),
  selfie_required: boolean('selfie_required').default(false),
  max_accuracy_meters: integer('max_accuracy_meters').default(50),
  max_stale_ms: integer('max_stale_ms').default(30000),
  created_by: text('created_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  type: shiftTypeEnum('type').default('fixed'),
  status: shiftStatusEnum('status').default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const employeeShifts = pgTable('employee_shifts', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  shift_id: integer('shift_id'),
  date: text('date').notNull(),
  check_in_time: text('check_in_time'),
  late_duration: real('late_duration'),
  check_in_latitude: real('check_in_latitude'),
  check_in_longitude: real('check_in_longitude'),
  check_in_accuracy: real('check_in_accuracy'),
  check_in_timestamp: timestamp('check_in_timestamp'),
  distance_to_office_in: real('distance_to_office_in'),
  check_in_photo: text('check_in_photo'),
  check_in_note: text('check_in_note'),
  check_out_time: text('check_out_time'),
  early_out_duration: real('early_out_duration'),
  check_out_latitude: real('check_out_latitude'),
  check_out_longitude: real('check_out_longitude'),
  check_out_accuracy: real('check_out_accuracy'),
  check_out_timestamp: timestamp('check_out_timestamp'),
  distance_to_office_out: real('distance_to_office_out'),
  check_out_photo: text('check_out_photo'),
  check_out_note: text('check_out_note'),
  attendance_status: text('attendance_status').notNull().default('pending'),
  gps_validation_enabled: boolean('gps_validation_enabled').default(true),
  selfie_required: boolean('selfie_required').default(false),
  validation_state: text('validation_state').default('valid'), // 'valid' | 'invalid' | 'disabled'
  lock_location: integer('lock_location').default(1),
  requested_check_in_time: text('requested_check_in_time'),
  requested_check_out_time: text('requested_check_out_time'),
  request_note: text('request_note'),
  request_status: leaveStatusEnum('request_status'),
  request_file: text('request_file'),
  comment: text('comment'),
  approved_by: text('approved_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const leaves = pgTable('leaves', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  shift_id: integer('shift_id'),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  total_days: real('total_days').notNull(),
  leave_type: leaveTypeEnum('leave_type').notNull(),
  reason: text('reason'),
  request_file: text('request_file'),
  status: leaveStatusEnum('status').notNull().default('pending'),
  approved_by: text('approved_by'),
  approved_date: text('approved_date'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const performanceReports = pgTable('performance_reports', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  date: text('date').notNull(),
  performance_type_id: integer('performance_type_id'),
  score: numeric('score', { precision: 10, scale: 2 }),
  running_average: numeric('running_average', { precision: 10, scale: 2 }),
  reference: text('reference'),
  reference_id: text('reference_id'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// --- New tables for schedule management ---

export const shiftWeekdayRules = pgTable('shift_weekday_rules', {
  id: serial('id').primaryKey(),
  shift_id: integer('shift_id').notNull(),
  day_of_week: integer('day_of_week').notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
  is_working_day: boolean('is_working_day').default(true),
  start_time: text('start_time'), // HH:MM
  end_time: text('end_time'), // HH:MM
  late_tolerance_minutes: integer('late_tolerance_minutes').default(0),
  absence_cutoff_minutes: integer('absence_cutoff_minutes').default(120),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const scheduleAssignments = pgTable('schedule_assignments', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  shift_id: integer('shift_id').notNull(),
  effective_from: text('effective_from').notNull(), // YYYY-MM-DD
  effective_to: text('effective_to'), // YYYY-MM-DD | null
  created_by: text('created_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const dateOverrides = pgTable('date_overrides', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  shift_id: integer('shift_id').notNull(),
  created_by: text('created_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const dayOffs = pgTable('day_offs', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  reason: text('reason'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const attendanceCorrections = pgTable('attendance_corrections', {
  id: serial('id').primaryKey(),
  attendance_id: integer('attendance_id').notNull(),
  actor_id: text('actor_id').notNull(),
  reason: text('reason').notNull(),
  previous_values: text('previous_values'), // JSON
  new_values: text('new_values'), // JSON
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Extend employee_shifts with policy context and validation state
// (will be done in a separate edit)

import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';

export const locationRelations = relations(locations, ({ many }) => ({
  employeeShifts: many(employeeShifts)
}));

export const shiftRelations = relations(shifts, ({ many }) => ({
  employeeShifts: many(employeeShifts),
  leaves: many(leaves)
}));

export const employeeShiftRelations = relations(employeeShifts, ({ one }) => ({
  user: one(user, {
    fields: [employeeShifts.user_id],
    references: [user.id]
  }),
  shift: one(shifts, {
    fields: [employeeShifts.shift_id],
    references: [shifts.id]
  })
}));

export const leaveRelations = relations(leaves, ({ one }) => ({
  user: one(user, {
    fields: [leaves.user_id],
    references: [user.id]
  }),
  shift: one(shifts, {
    fields: [leaves.shift_id],
    references: [shifts.id]
  })
}));

export const performanceReportRelations = relations(performanceReports, ({ one }) => ({
  user: one(user, {
    fields: [performanceReports.user_id],
    references: [user.id]
  })
}));

// --- Relations for new tables ---

export const shiftWeekdayRuleRelations = relations(shiftWeekdayRules, ({ one }) => ({
  shift: one(shifts, {
    fields: [shiftWeekdayRules.shift_id],
    references: [shifts.id]
  })
}));

export const scheduleAssignmentRelations = relations(scheduleAssignments, ({ one }) => ({
  user: one(user, {
    fields: [scheduleAssignments.user_id],
    references: [user.id]
  }),
  shift: one(shifts, {
    fields: [scheduleAssignments.shift_id],
    references: [shifts.id]
  })
}));

export const dateOverrideRelations = relations(dateOverrides, ({ one }) => ({
  user: one(user, {
    fields: [dateOverrides.user_id],
    references: [user.id]
  }),
  shift: one(shifts, {
    fields: [dateOverrides.shift_id],
    references: [shifts.id]
  })
}));

export const dayOffRelations = relations(dayOffs, ({ one }) => ({
  user: one(user, {
    fields: [dayOffs.user_id],
    references: [user.id]
  })
}));

export const attendanceCorrectionRelations = relations(attendanceCorrections, ({ one }) => ({
  attendance: one(employeeShifts, {
    fields: [attendanceCorrections.attendance_id],
    references: [employeeShifts.id]
  }),
  actor: one(user, {
    fields: [attendanceCorrections.actor_id],
    references: [user.id]
  })
}));

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

// New types
export type ShiftWeekdayRule = typeof shiftWeekdayRules.$inferSelect;
export type NewShiftWeekdayRule = typeof shiftWeekdayRules.$inferInsert;

export type ScheduleAssignment = typeof scheduleAssignments.$inferSelect;
export type NewScheduleAssignment = typeof scheduleAssignments.$inferInsert;

export type DateOverride = typeof dateOverrides.$inferSelect;
export type NewDateOverride = typeof dateOverrides.$inferInsert;

export type DayOff = typeof dayOffs.$inferSelect;
export type NewDayOff = typeof dayOffs.$inferInsert;

export type AttendanceCorrection = typeof attendanceCorrections.$inferSelect;
export type NewAttendanceCorrection = typeof attendanceCorrections.$inferInsert;

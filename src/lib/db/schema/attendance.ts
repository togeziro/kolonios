import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  integer,
  real
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
  distance_to_office_in: real('distance_to_office_in'),
  check_in_photo: text('check_in_photo'),
  check_in_note: text('check_in_note'),
  check_out_time: text('check_out_time'),
  early_out_duration: real('early_out_duration'),
  check_out_latitude: real('check_out_latitude'),
  check_out_longitude: real('check_out_longitude'),
  distance_to_office_out: real('distance_to_office_out'),
  check_out_photo: text('check_out_photo'),
  check_out_note: text('check_out_note'),
  attendance_status: text('attendance_status').notNull().default('pending'),
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

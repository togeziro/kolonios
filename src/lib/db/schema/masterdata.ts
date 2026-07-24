import { pgTable, serial, text, timestamp, boolean, real, integer } from 'drizzle-orm/pg-core';

/**
 * Masterdata tables for employee management
 * All column names use English for consistency with international codebase.
 */

// departments table
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// designations table (job titles/positions)
export const designations = pgTable('designations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  department_id: integer('department_id'),
  description: text('description'),
  base_salary: real('base_salary'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// employees table
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull().unique(),
  employee_code: text('employee_code').notNull().unique(),
  full_name: text('full_name').notNull(),
  nickname: text('nickname'),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  birth_place: text('birth_place'),
  birth_date: text('birth_date'),
  address: text('address'),
  id_number: text('id_number').unique(),
  department_id: integer('department_id'),
  designation_id: integer('designation_id'),
  is_internship: boolean('is_internship').default(false),
  employment_status: text('employment_status').default('active'),
  join_date: text('join_date'),
  leave_date: text('leave_date'),
  base_salary: real('base_salary'),
  status: text('status').default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Designation = typeof designations.$inferSelect;
export type NewDesignation = typeof designations.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

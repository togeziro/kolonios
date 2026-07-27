import { pgTable, serial, text, timestamp, boolean, real, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';

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

// employees table — id mirrors user.id (text), dropped user_id
export const employees = pgTable('employees', {
  id: text('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  employee_code: text('employee_code').notNull().unique(),
  full_name: text('full_name').notNull(),
  nickname: text('nickname').notNull().default(''),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  birth_place: text('birth_place').notNull().default(''),
  birth_date: text('birth_date').notNull(),
  address: text('address').notNull().default(''),
  id_number: text('id_number').notNull().default(''),
  department_id: integer('department_id').notNull(),
  designation_id: integer('designation_id').notNull(),
  is_internship: boolean('is_internship').notNull().default(false),
  employment_status: text('employment_status').notNull().default('active'),
  join_date: text('join_date').notNull(),
  leave_date: text('leave_date'),
  base_salary: real('base_salary').notNull().default(0),
  status: text('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const employeeRelations = relations(employees, ({ one }) => ({
  user: one(user, {
    fields: [employees.id],
    references: [user.id]
  }),
  department: one(departments, {
    fields: [employees.department_id],
    references: [departments.id]
  }),
  designation: one(designations, {
    fields: [employees.designation_id],
    references: [designations.id]
  })
}));

export const departmentRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
  designations: many(designations)
}));

export const designationRelations = relations(designations, ({ one, many }) => ({
  department: one(departments, {
    fields: [designations.department_id],
    references: [departments.id]
  }),
  employees: many(employees)
}));

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Designation = typeof designations.$inferSelect;
export type NewDesignation = typeof designations.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

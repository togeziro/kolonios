import { pgTable, serial, text, timestamp, boolean, real, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { employees } from './employees';

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

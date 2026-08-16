import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  real,
  integer,
  json
} from 'drizzle-orm/pg-core';
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

// company_settings table (singleton - one row only)
export const companySettings = pgTable('company_settings', {
  id: serial('id').primaryKey(),
  holiday_api_provider: text('holiday_api_provider').notNull().default('nager_date'),
  holiday_api_url: text('holiday_api_url'),
  holiday_api_key: text('holiday_api_key'),
  holiday_api_country_code: text('holiday_api_country_code').notNull().default('ID'),
  holiday_api_headers: json('holiday_api_headers')
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  holiday_api_response_mapping: json('holiday_api_response_mapping')
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  locale: text('locale').notNull().default('id-ID'),
  storage_provider: text('storage_provider').notNull().default('idrive_e2'),
  storage_endpoint: text('storage_endpoint'),
  storage_region: text('storage_region'),
  storage_bucket: text('storage_bucket'),
  storage_access_key: text('storage_access_key'),
  storage_secret_key: text('storage_secret_key'),
  storage_force_path_style: boolean('storage_force_path_style').notNull().default(false),
  worklog_location_lenient: boolean('worklog_location_lenient').notNull().default(false),
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

export type CompanySetting = typeof companySettings.$inferSelect;
export type NewCompanySetting = typeof companySettings.$inferInsert;

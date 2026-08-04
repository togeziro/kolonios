import { relations, sql } from 'drizzle-orm';
import {
  date,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { user } from '../auth-schema';
import { employees } from './employees';
import { departments, designations } from './masterdata';

export const payrollPeriodStatusEnum = pgEnum('payroll_period_status', [
  'draft',
  'processing',
  'ready_to_pay',
  'paid',
  'locked'
]);

export const salaryTypeEnum = pgEnum('salary_type', ['monthly', 'daily', 'hourly']);

export const salaryComponentTypeEnum = pgEnum('salary_component_type', ['allowance', 'deduction']);

export const salaryComponents = pgTable('salary_components', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: salaryComponentTypeEnum('type').notNull(),
  description: text('description'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const employeeSalaryAssignments = pgTable(
  'employee_salary_assignments',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    department_id: integer('department_id').references(() => departments.id),
    designation_id: integer('designation_id').references(() => designations.id),
    salary_type: salaryTypeEnum('salary_type').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    effective_from: date('effective_from').notNull(),
    effective_to: date('effective_to'),
    created_by: text('created_by').references(() => user.id),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('employee_salary_assignments_employee_effective_unique').on(
      table.employee_id,
      table.effective_from
    ),
    index('employee_salary_assignments_employee_effective_idx').on(
      table.employee_id,
      table.effective_from
    )
  ]
);

export const employeeSalaryComponents = pgTable(
  'employee_salary_components',
  {
    id: serial('id').primaryKey(),
    assignment_id: integer('assignment_id')
      .notNull()
      .references(() => employeeSalaryAssignments.id, { onDelete: 'cascade' }),
    salary_component_id: integer('salary_component_id')
      .notNull()
      .references(() => salaryComponents.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    effective_from: date('effective_from').notNull(),
    effective_to: date('effective_to'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('employee_salary_components_assignment_component_effective_unique').on(
      table.assignment_id,
      table.salary_component_id,
      table.effective_from
    ),
    index('employee_salary_components_effective_idx').on(table.effective_from)
  ]
);

export const payrollPeriods = pgTable(
  'payroll_periods',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    period_start: date('period_start').notNull(),
    period_end: date('period_end').notNull(),
    payment_date: date('payment_date').notNull(),
    status: payrollPeriodStatusEnum('status').notNull().default('draft'),
    processed_at: timestamp('processed_at'),
    paid_at: timestamp('paid_at'),
    created_by: text('created_by').references(() => user.id),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('payroll_periods_dates_unique').on(table.period_start, table.period_end),
    index('payroll_periods_status_idx').on(table.status)
  ]
);

export const payrollRecords = pgTable(
  'payroll_records',
  {
    id: serial('id').primaryKey(),
    payroll_period_id: integer('payroll_period_id')
      .notNull()
      .references(() => payrollPeriods.id, { onDelete: 'cascade' }),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    gross_salary: numeric('gross_salary', { precision: 14, scale: 2 }).notNull(),
    total_allowances: numeric('total_allowances', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    total_deductions: numeric('total_deductions', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    net_salary: numeric('net_salary', { precision: 14, scale: 2 }).notNull(),
    details: jsonb('details'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('payroll_records_period_employee_unique').on(
      table.payroll_period_id,
      table.employee_id
    ),
    unique('payroll_records_id_employee_unique').on(table.id, table.employee_id),
    index('payroll_records_employee_idx').on(table.employee_id)
  ]
);

export const payslips = pgTable(
  'payslips',
  {
    id: serial('id').primaryKey(),
    payroll_record_id: integer('payroll_record_id').notNull(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    payslip_number: text('payslip_number').notNull().unique(),
    issued_at: timestamp('issued_at').defaultNow().notNull(),
    file_url: text('file_url'),
    created_at: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.payroll_record_id, table.employee_id],
      foreignColumns: [payrollRecords.id, payrollRecords.employee_id],
      name: 'payslips_payroll_record_employee_fk'
    }).onDelete('cascade')
  ]
);

export const taxSettings = pgTable(
  'tax_settings',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    rates: jsonb('rates').notNull(),
    effective_from: date('effective_from').notNull(),
    effective_to: date('effective_to'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('tax_settings_code_effective_unique').on(table.code, table.effective_from)
  ]
);

export const employeeTaxProfiles = pgTable(
  'employee_tax_profiles',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    tax_setting_id: integer('tax_setting_id').references(() => taxSettings.id),
    tax_identifier: text('tax_identifier'),
    filing_status: text('filing_status'),
    effective_from: date('effective_from').notNull(),
    effective_to: date('effective_to'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('employee_tax_profiles_employee_effective_unique').on(
      table.employee_id,
      table.effective_from
    )
  ]
);

export const employeeTaxRecords = pgTable(
  'employee_tax_records',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    payroll_record_id: integer('payroll_record_id'),
    tax_period: date('tax_period').notNull(),
    taxable_income: numeric('taxable_income', { precision: 14, scale: 2 }).notNull(),
    tax_amount: numeric('tax_amount', { precision: 14, scale: 2 }).notNull(),
    details: jsonb('details'),
    created_at: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.payroll_record_id, table.employee_id],
      foreignColumns: [payrollRecords.id, payrollRecords.employee_id],
      name: 'employee_tax_records_payroll_record_employee_fk'
    }).onDelete('cascade'),
    index('employee_tax_records_employee_period_idx').on(table.employee_id, table.tax_period)
  ]
);

export const employeeBenefitEnrollments = pgTable(
  'employee_benefit_enrollments',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    benefit_code: text('benefit_code').notNull(),
    benefit_name: text('benefit_name').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }),
    effective_from: date('effective_from').notNull(),
    effective_to: date('effective_to'),
    status: text('status').notNull().default('active'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('employee_benefit_enrollments_employee_benefit_effective_unique').on(
      table.employee_id,
      table.benefit_code,
      table.effective_from
    )
  ]
);

export const employeeBankAccounts = pgTable(
  'employee_bank_accounts',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    bank_name: text('bank_name').notNull(),
    account_name: text('account_name').notNull(),
    account_number: text('account_number').notNull(),
    is_primary: boolean('is_primary').notNull().default(false),
    effective_from: date('effective_from').notNull(),
    effective_to: date('effective_to'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('employee_bank_accounts_primary_effective_unique')
      .on(table.employee_id, table.effective_from)
      .where(sql`${table.is_primary} = true`),
    index('employee_bank_accounts_employee_idx').on(table.employee_id)
  ]
);

export const employeeEmploymentEvents = pgTable(
  'employee_employment_events',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    event_type: text('event_type').notNull(),
    effective_date: date('effective_date').notNull(),
    details: jsonb('details'),
    created_by: text('created_by').references(() => user.id),
    created_at: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('employee_employment_events_employee_date_idx').on(
      table.employee_id,
      table.effective_date
    )
  ]
);

export const employeeDocuments = pgTable(
  'employee_documents',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    document_type: text('document_type').notNull(),
    file_name: text('file_name').notNull(),
    file_url: text('file_url').notNull(),
    issued_date: date('issued_date'),
    expiry_date: date('expiry_date'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('employee_documents_employee_type_idx').on(table.employee_id, table.document_type)
  ]
);

export const employeeSalaryAssignmentRelations = relations(
  employeeSalaryAssignments,
  ({ one, many }) => ({
    employee: one(employees, {
      fields: [employeeSalaryAssignments.employee_id],
      references: [employees.id]
    }),
    department: one(departments, {
      fields: [employeeSalaryAssignments.department_id],
      references: [departments.id]
    }),
    designation: one(designations, {
      fields: [employeeSalaryAssignments.designation_id],
      references: [designations.id]
    }),
    components: many(employeeSalaryComponents)
  })
);

export type SalaryComponent = typeof salaryComponents.$inferSelect;
export type NewSalaryComponent = typeof salaryComponents.$inferInsert;
export type EmployeeSalaryAssignment = typeof employeeSalaryAssignments.$inferSelect;
export type NewEmployeeSalaryAssignment = typeof employeeSalaryAssignments.$inferInsert;
export type EmployeeSalaryComponent = typeof employeeSalaryComponents.$inferSelect;
export type NewEmployeeSalaryComponent = typeof employeeSalaryComponents.$inferInsert;
export type PayrollPeriod = typeof payrollPeriods.$inferSelect;
export type NewPayrollPeriod = typeof payrollPeriods.$inferInsert;
export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type NewPayrollRecord = typeof payrollRecords.$inferInsert;
export type Payslip = typeof payslips.$inferSelect;
export type NewPayslip = typeof payslips.$inferInsert;
export type TaxSetting = typeof taxSettings.$inferSelect;
export type NewTaxSetting = typeof taxSettings.$inferInsert;
export type EmployeeTaxProfile = typeof employeeTaxProfiles.$inferSelect;
export type NewEmployeeTaxProfile = typeof employeeTaxProfiles.$inferInsert;
export type EmployeeTaxRecord = typeof employeeTaxRecords.$inferSelect;
export type NewEmployeeTaxRecord = typeof employeeTaxRecords.$inferInsert;
export type EmployeeBenefitEnrollment = typeof employeeBenefitEnrollments.$inferSelect;
export type NewEmployeeBenefitEnrollment = typeof employeeBenefitEnrollments.$inferInsert;
export type EmployeeBankAccount = typeof employeeBankAccounts.$inferSelect;
export type NewEmployeeBankAccount = typeof employeeBankAccounts.$inferInsert;
export type EmployeeEmploymentEvent = typeof employeeEmploymentEvents.$inferSelect;
export type NewEmployeeEmploymentEvent = typeof employeeEmploymentEvents.$inferInsert;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type NewEmployeeDocument = typeof employeeDocuments.$inferInsert;

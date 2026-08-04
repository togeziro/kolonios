import { describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { employees } from './schema/employees';
import {
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeDocuments,
  employeeEmploymentEvents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  employeeTaxRecords,
  payslips,
  payrollPeriodStatusEnum,
  payrollPeriods,
  payrollRecords,
  salaryComponentTypeEnum,
  salaryComponents,
  salaryTypeEnum,
  taxSettings
} from './schema/payroll';
import {
  resolveEffectiveRecord,
  requireEffectiveRecord,
  validatePayrollDateRange,
  assertEmployeeScope,
  assertPayrollTransition,
  assertPayrollRecordUnique
} from './payroll';

const migration = readFileSync(
  new URL('./migrations/0009_naive_eternity.sql', import.meta.url),
  'utf8'
);

const requiredTables = [
  salaryComponents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  payrollPeriods,
  payrollRecords,
  payslips,
  taxSettings,
  employeeTaxProfiles,
  employeeTaxRecords,
  employeeBenefitEnrollments,
  employeeBankAccounts,
  employeeEmploymentEvents,
  employeeDocuments
] as const;

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

function foreignKeyFor(
  table: Parameters<typeof getTableConfig>[0],
  localColumns: string[],
  foreignTable: Parameters<typeof getTableConfig>[0],
  foreignColumns: string[]
) {
  return getTableConfig(table).foreignKeys.find((key) => {
    const reference = key.reference();
    return (
      getTableName(reference.foreignTable) === getTableName(foreignTable) &&
      JSON.stringify(reference.columns.map((column) => column.name)) ===
        JSON.stringify(localColumns) &&
      JSON.stringify(reference.foreignColumns.map((column) => column.name)) ===
        JSON.stringify(foreignColumns)
    );
  });
}

describe('payroll schema contract', () => {
  it('exports every payroll table', () => {
    for (const table of requiredTables) {
      expect(table).toBeDefined();
    }
  });

  it('defines the required enum values', () => {
    expect(payrollPeriodStatusEnum.enumValues).toEqual([
      'draft',
      'processing',
      'ready_to_pay',
      'paid',
      'locked'
    ]);
    expect(salaryTypeEnum.enumValues).toEqual(['monthly', 'daily', 'hourly']);
    expect(salaryComponentTypeEnum.enumValues).toEqual(['allowance', 'deduction']);
  });

  it('uses text employee identifiers and effective-date fields', () => {
    expect(employeeSalaryAssignments.employee_id.columnType).toBe('PgText');
    expect(employeeSalaryAssignments.effective_from.columnType).toBe('PgDateString');
    expect(employeeSalaryComponents.effective_from.columnType).toBe('PgDateString');
    expect(employeeTaxRecords.employee_id.columnType).toBe('PgText');
  });

  it('allows tax profile history while preventing duplicate effective dates', () => {
    const config = getTableConfig(employeeTaxProfiles);
    expect(
      config.indexes.some(
        (index) => index.config.name === 'employee_tax_profiles_employee_effective_unique'
      )
    ).toBe(true);
    expect(
      config.uniqueConstraints.some(
        (constraint) => constraint.name === 'employee_tax_profiles_employee_id_unique'
      )
    ).toBe(false);
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "employee_tax_profiles_employee_effective_unique"'
    );
    expect(migration).toContain('DROP CONSTRAINT "employee_tax_profiles_employee_id_unique"');
    expect(migration).not.toContain('UNIQUE("employee_id")');
  });

  it('enforces one payroll record per employee in a payroll period', () => {
    const config = getTableConfig(payrollRecords);
    expect(
      config.indexes.some((index) => index.config.name === 'payroll_records_period_employee_unique')
    ).toBe(true);
    expect(columnNames(payrollPeriods)).toContain('status');
  });

  it('cascades employee-owned records when an employee is deleted', () => {
    expect(
      foreignKeyFor(employeeSalaryAssignments, ['employee_id'], employees, ['id'])?.onDelete
    ).toBe('cascade');
    expect(foreignKeyFor(employeeTaxRecords, ['employee_id'], employees, ['id'])?.onDelete).toBe(
      'cascade'
    );
    expect(foreignKeyFor(employeeBankAccounts, ['employee_id'], employees, ['id'])?.onDelete).toBe(
      'cascade'
    );
  });

  it('keeps payslips and tax records aligned with their payroll record employee', () => {
    expect(
      foreignKeyFor(payslips, ['payroll_record_id', 'employee_id'], payrollRecords, [
        'id',
        'employee_id'
      ])
    ).toBeDefined();
    expect(
      foreignKeyFor(employeeTaxRecords, ['payroll_record_id', 'employee_id'], payrollRecords, [
        'id',
        'employee_id'
      ])
    ).toBeDefined();
    expect(migration).toContain('FOREIGN KEY ("payroll_record_id","employee_id")');
  });

  it('adds lookup indexes for period status, tax records, and primary bank accounts', () => {
    expect(
      getTableConfig(payrollPeriods).indexes.some(
        (index) => index.config.name === 'payroll_periods_status_idx'
      )
    ).toBe(true);
    expect(
      getTableConfig(employeeTaxRecords).indexes.some(
        (index) => index.config.name === 'employee_tax_records_employee_period_idx'
      )
    ).toBe(true);
    expect(
      getTableConfig(employeeBankAccounts).indexes.some(
        (index) => index.config.name === 'employee_bank_accounts_primary_unique'
      )
    ).toBe(true);
  });
});

describe('payroll effective-date access', () => {
  it('resolves the latest record covering the as-of date and rejects overlap', () => {
    const records = [
      { id: 1, effective_from: '2026-01-01', effective_to: '2026-06-30' },
      { id: 2, effective_from: '2026-07-01', effective_to: null }
    ];
    expect(resolveEffectiveRecord('emp-1', '2026-08-01', records)).toEqual(records[1]);
    expect(resolveEffectiveRecord('emp-1', '2025-12-01', records)).toBeNull();
    expect(() =>
      resolveEffectiveRecord('emp-1', '2026-05-01', [
        records[0],
        { id: 3, effective_from: '2026-04-01', effective_to: '2026-08-01' }
      ])
    ).toThrow(/overlap/i);
  });

  it('rejects invalid ranges and missing employee scope', () => {
    expect(() => validatePayrollDateRange('2026-08-01', '2026-07-31')).toThrow(/start/i);
    expect(() => assertEmployeeScope(undefined)).toThrow(/employee/i);
    expect(() => requireEffectiveRecord('emp-1', '2026-08-01', [])).toThrow(
      /required payroll data/i
    );
  });

  it('rejects duplicate payroll records before insertion', () => {
    expect(() => assertPayrollRecordUnique(true)).toThrow(/duplicate/i);
    expect(() => assertPayrollRecordUnique(false)).not.toThrow();
  });

  it('rejects locked edits and invalid workflow transitions', () => {
    expect(() => assertPayrollTransition('locked', 'paid')).toThrow(/locked/i);
    expect(() => assertPayrollTransition('draft', 'paid')).toThrow(/transition/i);
    expect(() => assertPayrollTransition('paid', 'locked')).not.toThrow();
  });
});

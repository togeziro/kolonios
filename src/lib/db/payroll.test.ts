import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
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

  it('enforces one payroll record per employee in a payroll period', () => {
    const config = getTableConfig(payrollRecords);
    expect(
      config.indexes.some((index) => index.config.name === 'payroll_records_period_employee_unique')
    ).toBe(true);
    expect(columnNames(payrollPeriods)).toContain('status');
  });

  it('cascades employee-owned records when an employee is deleted', () => {
    for (const table of [employeeSalaryAssignments, employeeTaxRecords, employeeBankAccounts]) {
      const foreignKey = getTableConfig(table).foreignKeys.find(
        (key) => key.reference().columns.length === 1
      );
      expect(foreignKey?.onDelete).toBe('cascade');
    }
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

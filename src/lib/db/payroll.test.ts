import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { employees } from './schema/employees';
import { db } from './index';
import { resetAllTables, seedDepartment, seedDesignation, seedUser } from '@/test-utils/db';
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
  assertPayrollRecordUnique,
  resolveEffectiveRecords,
  assertPayrollPeriodUpdate,
  assertPayrollRecordMutation,
  assertEffectiveDate
} from './payroll';
import {
  createEmployeeTaxProfile,
  createPayrollRecord,
  createPayrollPeriod,
  createSalaryAssignment,
  generatePayrollRecords,
  getEffectiveTaxProfile,
  getPrimaryBankAccount,
  listPayrollRecords,
  transitionPayrollPeriod
} from './payroll';
import { withPayrollAuditTransaction } from './payroll';

const migration = readFileSync(
  new URL('./migrations/0009_naive_eternity.sql', import.meta.url),
  'utf8'
);
const effectiveBankMigration = readFileSync(
  new URL('./migrations/0010_workable_gertrude_yorkes.sql', import.meta.url),
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
    expect(employeeBankAccounts.effective_from.columnType).toBe('PgDateString');
    expect(employeeBankAccounts.effective_to.columnType).toBe('PgDateString');
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
        (index) => index.config.name === 'employee_bank_accounts_primary_effective_unique'
      )
    ).toBe(true);
    expect(effectiveBankMigration).toContain('ADD COLUMN "effective_from" date;');
    expect(effectiveBankMigration).toContain('"created_at"::date');
    expect(effectiveBankMigration).not.toContain("'1900-01-01'");
    expect(effectiveBankMigration).toContain('ADD COLUMN "effective_to" date');
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

  it('resolves every effective record used during a period and excludes outside records', () => {
    const rows = [
      { id: 1, effective_from: '2026-01-01', effective_to: '2026-06-30' },
      { id: 2, effective_from: '2026-07-01', effective_to: '2026-07-15' },
      { id: 3, effective_from: '2026-07-16', effective_to: null },
      { id: 4, effective_from: '2026-08-01', effective_to: null }
    ];
    expect(resolveEffectiveRecords('emp-1', '2026-07-01', '2026-07-31', rows)).toEqual([
      rows[1],
      rows[2]
    ]);
  });

  it('rejects status changes through period edits unless they are state-machine transitions', () => {
    expect(() => assertPayrollPeriodUpdate('draft', { status: 'paid' })).toThrow(/transition/i);
    expect(() => assertPayrollPeriodUpdate('draft', { status: 'processing' })).not.toThrow();
    expect(() => assertPayrollPeriodUpdate('locked', { name: 'No edit' })).toThrow(/locked/i);
  });

  it('rejects immutable payroll record identity changes', () => {
    expect(() => assertPayrollRecordMutation({ employee_id: 'other' }, 'employee-1', 10)).toThrow(
      /immutable/i
    );
    expect(() => assertPayrollRecordMutation({ payroll_period_id: 11 }, 'employee-1', 10)).toThrow(
      /immutable/i
    );
    expect(() => assertEffectiveDate('2026-02-30')).toThrow(/date/i);
  });
});

async function resetPayrollIntegrationTables() {
  await db.delete(employeeTaxRecords);
  await db.delete(payslips);
  await db.delete(employeeSalaryComponents);
  await db.delete(employeeSalaryAssignments);
  await db.delete(employeeTaxProfiles);
  await db.delete(employeeBenefitEnrollments);
  await db.delete(employeeBankAccounts);
  await db.delete(employeeEmploymentEvents);
  await db.delete(employeeDocuments);
  await db.delete(payrollRecords);
  await db.delete(payrollPeriods);
  await db.delete(salaryComponents);
  await db.delete(taxSettings);
  await resetAllTables();
}

describe('payroll data access (integration)', () => {
  beforeEach(resetPayrollIntegrationTables);
  afterAll(resetPayrollIntegrationTables);

  it('resolves the primary bank account as of a date', async () => {
    const department = await seedDepartment({ code: 'PAY-BANK-DEPT' });
    const designation = await seedDesignation(department.id, { code: 'PAY-BANK-DESIG' });
    await seedUser('payroll-bank-employee');
    await db.insert(employees).values({
      id: 'payroll-bank-employee',
      employee_code: 'PAY-BANK-1',
      full_name: 'Bank Employee',
      email: 'payroll-bank-employee@test.com',
      birth_date: '1990-01-01',
      department_id: department.id,
      designation_id: designation.id,
      join_date: '2024-01-01'
    });
    await db.insert(employeeBankAccounts).values([
      {
        employee_id: 'payroll-bank-employee',
        bank_name: 'Old Bank',
        account_name: 'Bank Employee',
        account_number: '111',
        is_primary: true,
        effective_from: '2026-01-01',
        effective_to: '2026-06-30'
      },
      {
        employee_id: 'payroll-bank-employee',
        bank_name: 'New Bank',
        account_name: 'Bank Employee',
        account_number: '222',
        is_primary: true,
        effective_from: '2026-07-01',
        effective_to: null
      }
    ]);
    expect((await getPrimaryBankAccount('payroll-bank-employee', '2026-08-01'))?.bank_name).toBe(
      'New Bank'
    );
  });

  it('rolls back generated records when one record fails', async () => {
    const period = await createPayrollPeriod({
      name: 'Rollback Period',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      payment_date: '2026-08-05'
    });
    await seedUser('payroll-generation-employee');
    const department = await seedDepartment({ code: 'PAY-GEN-DEPT' });
    const designation = await seedDesignation(department.id, { code: 'PAY-GEN-DESIG' });
    await db.insert(employees).values({
      id: 'payroll-generation-employee',
      employee_code: 'PAY-GEN-1',
      full_name: 'Generation Employee',
      email: 'payroll-generation-employee@test.com',
      birth_date: '1990-01-01',
      department_id: department.id,
      designation_id: designation.id,
      join_date: '2024-01-01'
    });
    await expect(
      generatePayrollRecords(period.id, [
        {
          payroll_period_id: period.id,
          employee_id: 'payroll-generation-employee',
          gross_salary: '100',
          net_salary: '100'
        },
        {
          payroll_period_id: period.id,
          employee_id: 'payroll-generation-employee',
          gross_salary: '200',
          net_salary: '200'
        }
      ])
    ).rejects.toThrow(/duplicate/i);
    expect(await db.select().from(payrollRecords)).toHaveLength(0);
    expect((await db.select().from(payrollPeriods))[0].status).toBe('draft');
  });

  it('rejects record creation after a period is locked and serializes overlapping assignments', async () => {
    const department = await seedDepartment({ code: 'PAY-CONCURRENCY-DEPT' });
    const designation = await seedDesignation(department.id, { code: 'PAY-CONCURRENCY-DESIG' });
    await seedUser('payroll-concurrency-employee');
    await db.insert(employees).values({
      id: 'payroll-concurrency-employee',
      employee_code: 'PAY-CONCURRENCY-1',
      full_name: 'Concurrency Employee',
      email: 'payroll-concurrency-employee@test.com',
      birth_date: '1990-01-01',
      department_id: department.id,
      designation_id: designation.id,
      join_date: '2024-01-01'
    });
    const period = await createPayrollPeriod({
      name: 'Locked Period',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      payment_date: '2026-09-05'
    });
    await transitionPayrollPeriod(period.id, 'processing');
    await transitionPayrollPeriod(period.id, 'ready_to_pay');
    await transitionPayrollPeriod(period.id, 'paid');
    await transitionPayrollPeriod(period.id, 'locked');
    await expect(
      createPayrollRecord({
        payroll_period_id: period.id,
        employee_id: 'payroll-concurrency-employee',
        gross_salary: '100',
        net_salary: '100'
      })
    ).rejects.toThrow(/locked/i);

    const results = await Promise.allSettled([
      createSalaryAssignment({
        employee_id: 'payroll-concurrency-employee',
        salary_type: 'monthly',
        amount: '100',
        effective_from: '2026-01-01',
        effective_to: null
      }),
      createSalaryAssignment({
        employee_id: 'payroll-concurrency-employee',
        salary_type: 'monthly',
        amount: '200',
        effective_from: '2026-01-01',
        effective_to: null
      })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('requires tax data and applies employee, department, and status record filters', async () => {
    await expect(getEffectiveTaxProfile('missing-employee', '2026-07-01')).rejects.toThrow(
      /required payroll data/i
    );
    const period = await createPayrollPeriod({
      name: 'Scoped Period',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      payment_date: '2026-08-05'
    });
    await transitionPayrollPeriod(period.id, 'processing');
    await transitionPayrollPeriod(period.id, 'ready_to_pay');
    const firstDepartment = await seedDepartment({ code: 'PAY-SCOPE-A' });
    const secondDepartment = await seedDepartment({ code: 'PAY-SCOPE-B' });
    const designation = await seedDesignation(firstDepartment.id, { code: 'PAY-SCOPE-D' });
    await seedUser('payroll-scope-a');
    await seedUser('payroll-scope-b');
    await db.insert(employees).values([
      {
        id: 'payroll-scope-a',
        employee_code: 'PAY-SCOPE-A',
        full_name: 'Scope A',
        email: 'payroll-scope-a@test.com',
        birth_date: '1990-01-01',
        department_id: firstDepartment.id,
        designation_id: designation.id,
        join_date: '2024-01-01'
      },
      {
        id: 'payroll-scope-b',
        employee_code: 'PAY-SCOPE-B',
        full_name: 'Scope B',
        email: 'payroll-scope-b@test.com',
        birth_date: '1990-01-01',
        department_id: secondDepartment.id,
        designation_id: designation.id,
        join_date: '2024-01-01'
      }
    ]);
    await db.insert(payrollRecords).values([
      {
        payroll_period_id: period.id,
        employee_id: 'payroll-scope-a',
        gross_salary: '100',
        net_salary: '100'
      },
      {
        payroll_period_id: period.id,
        employee_id: 'payroll-scope-b',
        gross_salary: '100',
        net_salary: '100'
      }
    ]);
    const adminRows = await listPayrollRecords({
      scope: 'admin',
      department_id: firstDepartment.id,
      status: 'ready_to_pay'
    });
    expect(adminRows.rows).toHaveLength(1);
    await expect(listPayrollRecords({ scope: 'employee' })).rejects.toThrow(/employee/i);
    const profile = await createEmployeeTaxProfile({
      employee_id: 'payroll-scope-a',
      effective_from: '2026-07-01'
    });
    expect((await getEffectiveTaxProfile('payroll-scope-a', '2026-07-01')).id).toBe(profile.id);
  });

  it('rolls back payroll data when the audit insert fails', async () => {
    await expect(
      withPayrollAuditTransaction(
        'missing-audit-actor',
        { action: 'payroll.test.rollback', entityType: 'salary_component' },
        async (tx) => {
          await tx
            .insert(salaryComponents)
            .values({ code: 'ROLLBACK-AUDIT', name: 'Rollback', type: 'allowance' });
          return true;
        }
      )
    ).rejects.toThrow();
    expect(await db.select().from(salaryComponents)).toHaveLength(0);
  });
});

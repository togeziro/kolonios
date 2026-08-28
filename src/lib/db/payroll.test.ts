import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { employees } from './schema/employees';
import { auditLog } from './schema/audit-log';
import { db } from './index';
import { resetAllTables, seedDepartment, seedDesignation, seedUser } from '@/test-utils/db';
import { departments, designations } from './schema/masterdata';
import { locations } from './schema/attendance';
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
  createSalaryComponent,
  deletePayrollPeriod,
  deleteSalaryComponent,
  generatePayrollRecords,
  getEffectiveTaxProfile,
  getEmploymentContext,
  getPayrollPeriod,
  getPrimaryBankAccount,
  getSalaryComponent,
  listMyPayslips,
  listPayrollPeriods,
  listPayrollRecords,
  listSalaryComponents,
  getPayQueue,
  stampPayrollRecords,
  stampUnstampedPayrollRecords,
  transitionPayrollPeriod,
  updatePayrollPeriod,
  updateSalaryComponent
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
const payrollModesMigration = readFileSync(
  new URL('./migrations/0013_great_vivisector.sql', import.meta.url),
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
    expect(employeeSalaryComponents.mode).toBeDefined();
    expect(employeeSalaryComponents.taxable).toBeDefined();
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

  it('carries a nullable payment stamp on each payroll record', () => {
    expect(columnNames(payrollRecords)).toContain('paid_at');
    expect(columnNames(payrollRecords)).toContain('paid_by');
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

  it('migrates persisted salary component calculation modes and leave payability', () => {
    expect(payrollModesMigration).toContain('ADD COLUMN "mode" text DEFAULT \'fixed\' NOT NULL');
    expect(payrollModesMigration).toContain('ADD COLUMN "taxable" boolean DEFAULT false NOT NULL');
    expect(payrollModesMigration).toContain('ADD COLUMN "is_paid" boolean DEFAULT true NOT NULL');
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
    // Stamp the records (also flips the period on the last stamp per ADR-0003)
    // so the period stays consistent with the per-record paid_at invariant.
    const allRecords = await db
      .select({ id: payrollRecords.id })
      .from(payrollRecords)
      .where(eq(payrollRecords.payroll_period_id, period.id));
    await stampPayrollRecords(
      allRecords.map((row) => row.id),
      'payroll-scope-a'
    );
    const employeeRows = await listMyPayslips('payroll-scope-a');
    expect(employeeRows.rows).toHaveLength(1);
    expect(employeeRows.rows[0]?.employee_id).toBe('payroll-scope-a');
    expect(employeeRows.rows.some((row) => row.employee_id === 'payroll-scope-b')).toBe(false);
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

  it('creates, reads, updates, lists, and deletes salary components', async () => {
    const created = await createSalaryComponent({
      code: 'OVERTIME',
      name: 'Overtime Pay',
      type: 'allowance',
      description: 'Hourly overtime'
    });
    expect(created.id).toBeGreaterThan(0);

    const fetched = await getSalaryComponent(created.id);
    expect(fetched?.code).toBe('OVERTIME');
    expect(await getSalaryComponent(999_999)).toBeNull();

    const listed = await listSalaryComponents();
    expect(listed.some((c) => c.id === created.id)).toBe(true);
    const inactive = await createSalaryComponent({
      code: 'OLD_BONUS',
      name: 'Old Bonus',
      type: 'allowance',
      is_active: false
    });
    expect(
      listSalaryComponents().then((rows) => rows.some((c) => c.id === inactive.id))
    ).resolves.toBe(false);
    expect(
      listSalaryComponents(true).then((rows) => rows.some((c) => c.id === inactive.id))
    ).resolves.toBe(true);

    const updated = await updateSalaryComponent(created.id, { name: 'Overtime Allowance' });
    expect(updated.name).toBe('Overtime Allowance');

    expect(await deleteSalaryComponent(created.id)).toBe(true);
    expect(await deleteSalaryComponent(created.id)).toBe(false);
    expect(await getSalaryComponent(created.id)).toBeNull();
  });

  it('creates, reads, updates, lists, and deletes payroll periods', async () => {
    const created = await createPayrollPeriod({
      name: 'Period CRUD',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      payment_date: '2026-08-05'
    });
    expect(created.id).toBeGreaterThan(0);

    const fetched = await getPayrollPeriod(created.id);
    expect(fetched?.name).toBe('Period CRUD');
    expect(await getPayrollPeriod(999_999)).toBeNull();

    const listed = await listPayrollPeriods();
    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.rows.some((p) => p.id === created.id)).toBe(true);
    const byStatus = await listPayrollPeriods({ status: 'draft', page: 1, limit: 10 });
    expect(byStatus.rows.every((p) => p.status === 'draft')).toBe(true);

    const updated = await updatePayrollPeriod(created.id, { name: 'Period CRUD Updated' });
    expect(updated.name).toBe('Period CRUD Updated');

    expect(await deletePayrollPeriod(created.id)).toBe(true);
    expect(await getPayrollPeriod(created.id)).toBeNull();
  });

  it('returns employment context with events for an employee', async () => {
    const department = await seedDepartment({ code: 'PAY-CTX-DEPT' });
    const designation = await seedDesignation(department.id, { code: 'PAY-CTX-DESIG' });
    await seedUser('payroll-context-employee');
    await db.insert(employees).values({
      id: 'payroll-context-employee',
      employee_code: 'PAY-CTX-1',
      full_name: 'Context Employee',
      email: 'payroll-context-employee@test.com',
      birth_date: '1990-01-01',
      department_id: department.id,
      designation_id: designation.id,
      join_date: '2024-01-01'
    });
    await db.insert(employeeEmploymentEvents).values({
      employee_id: 'payroll-context-employee',
      event_type: 'hiring',
      effective_date: '2024-01-01'
    });

    const ctx = await getEmploymentContext('payroll-context-employee', '2026-08-01');
    expect(ctx.employee.employee_code).toBe('PAY-CTX-1');
    expect(ctx.department?.code).toBe('PAY-CTX-DEPT');
    expect(ctx.events).toHaveLength(1);
  });
});

/** Insert an employee with test-unique codes without touching the shared
 *  seedEmployee counter (which collides across retries/processes). */
async function seedQueueEmployee(id: string, fullName: string, departmentId?: number) {
  await seedUser(id);
  const department =
    departmentId ??
    (
      await db
        .insert(departments)
        .values({ name: `${fullName} Dept`, code: `PQD-${id.toUpperCase()}` })
        .returning()
    )[0].id;
  const [designation] = await db
    .insert(designations)
    .values({
      name: `${fullName} Role`,
      code: `PQG-${id.toUpperCase()}`,
      department_id: department
    })
    .returning();
  const location = (
    await db
      .insert(locations)
      .values({ name: `Loc ${id}`, latitude: -6.2, longitude: 106.8, radius: 100 })
      .returning()
  )[0];
  await db.insert(employees).values({
    id,
    employee_code: `PQ-${id.toUpperCase()}`,
    full_name: fullName,
    email: `${id}@test.com`,
    birth_date: '1990-01-01',
    department_id: department,
    designation_id: designation.id,
    location_id: location.id,
    join_date: '2024-01-01'
  });
}

describe('pay queue per-record payment', () => {
  beforeEach(resetAllTables);

  async function seedReadyPeriodWithRecords(employeeIds: string[]) {
    await seedUser('pay-queue-admin');
    for (const [index, id] of employeeIds.entries()) {
      await seedQueueEmployee(id, `Employee ${index + 1}`);
    }
    const period = await createPayrollPeriod({
      name: 'Periode Jul 2026',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      payment_date: '2026-08-07',
      status: 'draft',
      created_by: 'pay-queue-admin'
    });
    if (!period) throw new Error('period not created');
    await transitionPayrollPeriod(period.id, 'processing');
    await transitionPayrollPeriod(period.id, 'ready_to_pay');
    const records = [];
    for (const employeeId of employeeIds) {
      const record = await createPayrollRecord({
        payroll_period_id: period.id,
        employee_id: employeeId,
        gross_salary: '5000000',
        net_salary: '4500000'
      });
      if (!record) throw new Error(`record not created for ${employeeId}`);
      records.push(record);
    }
    return { period, records };
  }

  it('stamps exactly the selection and flips the period only when its last unstamped record goes', async () => {
    const { period, records } = await seedReadyPeriodWithRecords(['pq-emp-1', 'pq-emp-2']);
    const [first, second] = records;

    const partial = await stampPayrollRecords([first.id], 'pay-queue-admin');
    expect(partial.stamped).toBe(1);
    expect(partial.flippedPeriodIds).toEqual([]);
    expect((await getPayrollPeriod(period.id))?.status).toBe('ready_to_pay');

    // Stamping is one-way and ignores unknown or already-stamped ids.
    const replayed = await stampPayrollRecords([first.id, 999_999], 'pay-queue-admin');
    expect(replayed.stamped).toBe(0);
    expect(replayed.flippedPeriodIds).toEqual([]);

    const final = await stampPayrollRecords([second.id], 'pay-queue-admin');
    expect(final.stamped).toBe(1);
    expect(final.flippedPeriodIds).toEqual([period.id]);
    expect((await getPayrollPeriod(period.id))?.status).toBe('paid');

    const rows = await db.select().from(payrollRecords).orderBy(payrollRecords.id);
    for (const row of rows) {
      expect(row.paid_at).not.toBeNull();
      expect(row.paid_by).toBe('pay-queue-admin');
    }
  });

  it('never stamps records whose period is not ready to pay', async () => {
    const { period, records } = await seedReadyPeriodWithRecords(['pq-emp-3']);
    await transitionPayrollPeriod(period.id, 'paid');

    const result = await stampPayrollRecords([records[0].id], 'pay-queue-admin');
    expect(result.stamped).toBe(0);
    expect(result.flippedPeriodIds).toEqual([]);
  });

  it('leaves an audit trail for each pay action', async () => {
    await seedUser('pay-queue-auditor');
    const { records } = await seedReadyPeriodWithRecords(['pq-emp-4']);
    await stampPayrollRecords([records[0].id], 'pay-queue-auditor');

    const entries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'payroll.record.pay'));
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some((entry) => entry.actorUserId === 'pay-queue-auditor')).toBe(true);
  });

  it('stamps every remaining record of a period when it is fully paid', async () => {
    const { records } = await seedReadyPeriodWithRecords(['pq-emp-5', 'pq-emp-6']);
    const [first] = records;
    await stampPayrollRecords([first.id], 'pay-queue-admin');

    let stampedInTx = 0;
    await db.transaction(async (tx) => {
      stampedInTx = await stampUnstampedPayrollRecords(
        tx,
        first.payroll_period_id,
        'pay-queue-admin'
      );
    });
    expect(stampedInTx).toBe(1);

    await transitionPayrollPeriod(first.payroll_period_id, 'paid');
    const rows = await db
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.payroll_period_id, first.payroll_period_id));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.paid_at).not.toBeNull();
      expect(row.paid_by).toBe('pay-queue-admin');
    }
  });

  it('persists a computed audit payload for the whole-period pay action', async () => {
    const { period } = await seedReadyPeriodWithRecords(['pq-emp-7']);
    await withPayrollAuditTransaction(
      'pay-queue-admin',
      {
        action: 'payroll.period.fully-paid',
        entityType: 'payroll_period',
        entityId: period.id,
        after: (result: { stampedRecords: number }) => ({
          stampedRecords: result.stampedRecords
        })
      },
      async () => ({ stampedRecords: 1 })
    );

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'payroll.period.fully-paid'));
    expect(entry).toBeDefined();
    expect(entry.after).toEqual({ stampedRecords: 1 });
  });

  it('keeps listPayrollRecords and getPayQueue consistent after a partial bulk-pay stamp (issue #02)', async () => {
    // Reproduce the silent-failure contract: bulk-pay stamps only the selected
    // record(s). The period stays in ready_to_pay, but the per-record paid_at
    // must be the source of truth for every downstream surface (records list,
    // payment history, action menu, queue filter).
    const { period, records } = await seedReadyPeriodWithRecords(['pq-bulk-1', 'pq-bulk-2']);
    const [selected, other] = records;

    const result = await stampPayrollRecords([selected.id], 'pay-queue-admin');
    expect(result.stamped).toBe(1);
    expect(result.flippedPeriodIds).toEqual([]);

    // Period status did NOT flip (other record is still unpaid) — ADR-0003 holds.
    expect((await getPayrollPeriod(period.id))?.status).toBe('ready_to_pay');

    // listPayrollRecords returns both rows. The stamped one MUST carry
    // paid_at + paid_by so the records page can render "Paid" per-record.
    const listed = await listPayrollRecords({ payroll_period_id: period.id });
    expect(listed.rows).toHaveLength(2);
    const stampedListed = listed.rows.find((row) => row.id === selected.id);
    const otherListed = listed.rows.find((row) => row.id === other.id);
    expect(stampedListed?.paid_at).not.toBeNull();
    expect(stampedListed?.paid_by).toBe('pay-queue-admin');
    expect(stampedListed?.period_status).toBe('ready_to_pay');
    expect(otherListed?.paid_at).toBeNull();
    expect(otherListed?.period_status).toBe('ready_to_pay');

    // getPayQueue must exclude the stamped row (already paid) and keep the
    // unstamped one — same period, same ready_to_pay status.
    const queue = await getPayQueue();
    const queueRecordIds = queue.rows.map((row) => row.recordId);
    expect(queueRecordIds).toContain(other.id);
    expect(queueRecordIds).not.toContain(selected.id);
  });

  it('returns the stamped record from listMyPayslips even when its period is still ready_to_pay (issue #04)', async () => {
    // Reproduce the partial-pay contract: bulk-pay stamps exactly the selected
    // record; the period stays ready_to_pay. Per ADR-0003 the employee's own
    // payslip view must surface the stamped record anyway — paying one row
    // out of many must not hide that employee's payslip from them.
    const { period, records } = await seedReadyPeriodWithRecords(['pq-self-1', 'pq-self-2']);
    const [selected] = records;

    await stampPayrollRecords([selected.id], 'pay-queue-admin');

    // Sanity: period is still ready_to_pay (not flipped because the other record is unpaid).
    expect((await getPayrollPeriod(period.id))?.status).toBe('ready_to_pay');

    // The employee whose record was stamped MUST see it in their payslips.
    const stampedEmployeePayslips = await listMyPayslips('pq-self-1');
    expect(stampedEmployeePayslips.rows).toHaveLength(1);
    expect(stampedEmployeePayslips.rows[0]?.id).toBe(selected.id);
    expect(stampedEmployeePayslips.rows[0]?.paid_at).not.toBeNull();

    // The other (still-unpaid) employee MUST NOT see a payslip yet.
    const unpaidEmployeePayslips = await listMyPayslips('pq-self-2');
    expect(unpaidEmployeePayslips.rows).toHaveLength(0);
  });
});

describe('pay queue read model', () => {
  beforeEach(resetAllTables);

  async function seedQueueFixture() {
    await seedUser('pay-queue-admin');
    const operations = await seedDepartment({ name: 'Operations', code: 'PQ-OPS' });
    const support = await seedDepartment({ name: 'Support', code: 'PQ-SUP' });
    const ada = { employee: { id: 'pq-ada' } };
    const budi = { employee: { id: 'pq-budi' } };
    const cici = { employee: { id: 'pq-cici' } };
    await seedQueueEmployee(ada.employee.id, 'Ada A', operations.id);
    await seedQueueEmployee(budi.employee.id, 'Budi B', support.id);
    await seedQueueEmployee(cici.employee.id, 'Cici C', support.id);
    await db.insert(employeeBankAccounts).values([
      {
        employee_id: ada.employee.id,
        bank_name: 'BCA',
        account_name: 'Ada A',
        account_number: '1234567890',
        is_primary: true,
        effective_from: '2026-01-01'
      },
      {
        employee_id: budi.employee.id,
        bank_name: 'Mandiri',
        account_name: 'Budi B',
        account_number: '0987654321',
        is_primary: true,
        effective_from: '2026-01-01'
      }
    ]);

    const period = await createPayrollPeriod({
      name: 'Periode Jul 2026',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      payment_date: '2026-08-07',
      status: 'draft',
      created_by: 'pay-queue-admin'
    });
    if (!period) throw new Error('period not created');
    await transitionPayrollPeriod(period.id, 'processing');
    await transitionPayrollPeriod(period.id, 'ready_to_pay');

    const processingPeriod = await createPayrollPeriod({
      name: 'Periode Agu 2026',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      payment_date: '2026-09-07',
      status: 'draft',
      created_by: 'pay-queue-admin'
    });
    if (!processingPeriod) throw new Error('processing period not created');
    await transitionPayrollPeriod(processingPeriod.id, 'processing');

    async function addRecord(periodId: number, employeeId: string, net: string) {
      const record = await createPayrollRecord({
        payroll_period_id: periodId,
        employee_id: employeeId,
        gross_salary: '6000000',
        net_salary: net
      });
      if (!record) throw new Error(`record not created for ${employeeId}`);
      return record;
    }

    const adaRecord = await addRecord(period.id, ada.employee.id, '4500000');
    const budiRecord = await addRecord(period.id, budi.employee.id, '1000000');
    const ciciRecord = await addRecord(period.id, cici.employee.id, '1000000');
    await addRecord(processingPeriod.id, cici.employee.id, '990000');

    return {
      operations,
      support,
      ada,
      period,
      processingPeriod,
      adaRecord,
      budiRecord,
      ciciRecord
    };
  }

  it('lists unpaid records of ready-to-pay periods with employee, division and bank context', async () => {
    const { period, adaRecord, budiRecord, ciciRecord } = await seedQueueFixture();

    const view = await getPayQueue({});
    expect(view.rows.map((row) => row.recordId)).toEqual([
      adaRecord.id,
      budiRecord.id,
      ciciRecord.id
    ]);
    expect(view.rows[0]).toMatchObject({
      employeeId: 'pq-ada',
      employeeName: 'Ada A',
      departmentName: 'Operations',
      periodName: 'Periode Jul 2026',
      paymentDate: '2026-08-07',
      bankName: 'BCA',
      accountNumber: '1234567890',
      netSalary: '4500000.00'
    });
    expect(view.totals).toEqual({ totalNet: '6500000.00', employeeCount: 3 });
    expect(view.periods.map((p) => p.id)).toEqual([period.id]);
  });

  it('scopes rows and totals to the division filter without changing what is payable', async () => {
    const { support, budiRecord, ciciRecord } = await seedQueueFixture();

    const view = await getPayQueue({ departmentId: support.id });
    expect(view.rows.map((row) => row.recordId)).toEqual([budiRecord.id, ciciRecord.id]);
    expect(view.totals).toEqual({ totalNet: '2000000.00', employeeCount: 2 });

    const other = await getPayQueue({ departmentId: support.id + 999 });
    expect(other.rows).toHaveLength(0);
    expect(other.totals).toEqual({ totalNet: '0', employeeCount: 0 });
  });

  it('drops stamped records from the queue immediately', async () => {
    const { adaRecord, budiRecord, ciciRecord } = await seedQueueFixture();
    await stampPayrollRecords([adaRecord.id], 'pay-queue-admin');

    const view = await getPayQueue({});
    expect(view.rows.map((row) => row.recordId)).toEqual([budiRecord.id, ciciRecord.id]);
    expect(view.totals.totalNet).toBe('2000000.00');
  });

  it('counts distinct employees in the summary even across multiple queued periods', async () => {
    const { ada } = await seedQueueFixture();
    const secondPeriod = await createPayrollPeriod({
      name: 'Periode Jun 2026',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      payment_date: '2026-07-07',
      status: 'draft',
      created_by: 'pay-queue-admin'
    });
    if (!secondPeriod) throw new Error('second period not created');
    await transitionPayrollPeriod(secondPeriod.id, 'processing');
    await transitionPayrollPeriod(secondPeriod.id, 'ready_to_pay');
    const repeat = await createPayrollRecord({
      payroll_period_id: secondPeriod.id,
      employee_id: ada.employee.id,
      gross_salary: '6000000',
      net_salary: '500000'
    });
    if (!repeat) throw new Error('repeat record not created');

    const view = await getPayQueue({});
    expect(view.rows).toHaveLength(4);
    expect(view.totals.employeeCount).toBe(3);
  });
});

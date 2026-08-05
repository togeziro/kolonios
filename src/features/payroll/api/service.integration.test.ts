import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema/employees';
import {
  resetAllTables,
  seedDepartment,
  seedDesignation,
  seedEmployee,
  seedUser
} from '@/test-utils/db';
import {
  companyPayrollSettings,
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeBpjsEnrollments,
  employeeBpjsFamilyMembers,
  employeeDocuments,
  employeeEmploymentEvents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  employeeTaxRecords,
  payslips,
  payrollAttendanceOverrides,
  payrollPeriods,
  payrollRecords,
  salaryComponents,
  taxSettings
} from '@/lib/db/schema/payroll';
import {
  createEmployeeBpjsFamilyMemberFn,
  deleteEmployeeBpjsFamilyMemberFn,
  generatePayrollFn,
  getCompanyPayrollSettingsFn,
  getMyPayslipsFn,
  listEmployeeBpjsEnrollmentsFn,
  listPayrollRecordsFn,
  overrideEmployeeTaxRecordFn,
  updateCompanyPayrollSettingsFn,
  upsertAttendanceOverrideFn,
  upsertEmployeeBpjsEnrollmentFn
} from './service';
// The split query supplies the production provider handler behind each exported
// server-function caller, avoiding a network request while retaining its boundary.
// The ssr-rpc mock funnels every caller through the single `serverFnProvider.handler`,
// so each test points it at the split handler of the fn it exercises.
import {
  createEmployeeBpjsFamilyMemberFn_createServerFn_handler,
  deleteEmployeeBpjsFamilyMemberFn_createServerFn_handler,
  generatePayrollFn_createServerFn_handler,
  getCompanyPayrollSettingsFn_createServerFn_handler,
  getMyPayslipsFn_createServerFn_handler,
  listEmployeeBpjsEnrollmentsFn_createServerFn_handler,
  listPayrollRecordsFn_createServerFn_handler,
  overrideEmployeeTaxRecordFn_createServerFn_handler,
  updateCompanyPayrollSettingsFn_createServerFn_handler,
  upsertAttendanceOverrideFn_createServerFn_handler,
  upsertEmployeeBpjsEnrollmentFn_createServerFn_handler
  // @ts-expect-error TanStack Start's provider query is a Vite-only module id.
} from './service?tss-serverfn-split';

const sessionUser = vi.hoisted(() => ({ id: 'payroll-boundary-a', role: 'employee' }));
const getSessionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const getRequestHeadersMock = vi.hoisted(() => vi.fn(() => new Headers()));
const getUserRoleGroupMock = vi.hoisted(() =>
  vi.fn(async () => ({ is_admin: false, permissions: { payroll: { view: true, edit: true } } }))
);
const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));
const createServerFnMock = vi.hoisted(() => {
  return () => {
    let validator: { parse(input: unknown): unknown } | undefined;
    const builder = {
      validator(nextValidator: { parse(input: unknown): unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(...handlers: Array<(context: { data: unknown }) => unknown>) {
        const nextHandler = handlers.at(-1)!;
        const invoke = async (options: { data: unknown }) =>
          nextHandler({ data: validator ? validator.parse(options.data) : options.data });
        return Object.assign(invoke, { __executeServer: invoke });
      }
    };
    return builder;
  };
});

vi.mock('@tanstack/react-start', () => ({
  createServerFn: createServerFnMock,
  createServerOnlyFn: (fn: (...args: never[]) => unknown) => fn,
  createMiddleware: () => ({ server: (fn: unknown) => fn })
}));

vi.mock('@tanstack/react-start/server-rpc', () => ({
  createServerRpc: (_meta: unknown, fn: (options: unknown) => unknown) => fn
}));

vi.mock('@tanstack/react-start/ssr-rpc', () => ({
  createSsrRpc: () => (options: { data: unknown }) => serverFnProvider.handler!(options)
}));

vi.mock('@/lib/auth/auth.server', () => ({
  auth: { api: { getSession: getSessionMock } }
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock
}));

vi.mock('@/lib/db/role-groups', () => ({
  getUserRoleGroup: getUserRoleGroupMock
}));

serverFnProvider.handler = getMyPayslipsFn_createServerFn_handler;

async function resetPayrollTables() {
  await db.delete(employeeTaxRecords);
  await db.delete(employeeBpjsFamilyMembers);
  await db.delete(employeeBpjsEnrollments);
  await db.delete(payrollAttendanceOverrides);
  await db.delete(companyPayrollSettings);
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

describe('getMyPayslipsFn authenticated boundary', () => {
  beforeEach(async () => {
    await resetPayrollTables();
    sessionUser.id = 'payroll-boundary-a';
    getSessionMock.mockClear();
    getRequestHeadersMock.mockClear();
    getUserRoleGroupMock.mockClear();
  });

  afterAll(resetPayrollTables);

  it('returns only employee A paid/locked payslips when the request attempts employee B scope', async () => {
    const department = await seedDepartment({ code: 'PAY-BOUNDARY-DEPT' });
    const designation = await seedDesignation(department.id, { code: 'PAY-BOUNDARY-DESIG' });
    await seedUser('payroll-boundary-a');
    await seedUser('payroll-boundary-b');
    await db.insert(employees).values([
      {
        id: 'payroll-boundary-a',
        employee_code: 'PAY-BOUNDARY-A',
        full_name: 'Boundary A',
        email: 'payroll-boundary-a@test.com',
        birth_date: '1990-01-01',
        department_id: department.id,
        designation_id: designation.id,
        join_date: '2024-01-01'
      },
      {
        id: 'payroll-boundary-b',
        employee_code: 'PAY-BOUNDARY-B',
        full_name: 'Boundary B',
        email: 'payroll-boundary-b@test.com',
        birth_date: '1990-01-01',
        department_id: department.id,
        designation_id: designation.id,
        join_date: '2024-01-01'
      }
    ]);
    const [paidPeriod] = await db
      .insert(payrollPeriods)
      .values({
        name: 'Boundary Paid Period',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        payment_date: '2026-08-05',
        status: 'paid'
      })
      .returning({ id: payrollPeriods.id });
    const [draftPeriod] = await db
      .insert(payrollPeriods)
      .values({
        name: 'Boundary Draft Period',
        period_start: '2026-08-01',
        period_end: '2026-08-31',
        payment_date: '2026-09-05',
        status: 'processing'
      })
      .returning({ id: payrollPeriods.id });
    const [lockedPeriod] = await db
      .insert(payrollPeriods)
      .values({
        name: 'Boundary Locked Period',
        period_start: '2026-06-01',
        period_end: '2026-06-30',
        payment_date: '2026-07-05',
        status: 'locked'
      })
      .returning({ id: payrollPeriods.id });
    await db.insert(payrollRecords).values([
      {
        payroll_period_id: paidPeriod.id,
        employee_id: 'payroll-boundary-a',
        gross_salary: '100',
        net_salary: '90'
      },
      {
        payroll_period_id: paidPeriod.id,
        employee_id: 'payroll-boundary-b',
        gross_salary: '200',
        net_salary: '180'
      },
      {
        payroll_period_id: draftPeriod.id,
        employee_id: 'payroll-boundary-a',
        gross_salary: '300',
        net_salary: '270'
      },
      {
        payroll_period_id: lockedPeriod.id,
        employee_id: 'payroll-boundary-a',
        gross_salary: '400',
        net_salary: '360'
      }
    ]);

    const result = await getMyPayslipsFn({
      data: { employeeId: 'payroll-boundary-b' }
    } as never);

    expect(result.rows).toHaveLength(2);
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ employee_id: 'payroll-boundary-a', period_status: 'paid' }),
        expect.objectContaining({ employee_id: 'payroll-boundary-a', period_status: 'locked' })
      ])
    );
    expect(
      result.rows.some((row: { employee_id: string }) => row.employee_id === 'payroll-boundary-b')
    ).toBe(false);
    expect(
      result.rows.some((row: { period_status: string }) => row.period_status === 'processing')
    ).toBe(false);
    expect(getSessionMock).toHaveBeenCalled();
    expect(getRequestHeadersMock).toHaveBeenCalled();
    expect(getUserRoleGroupMock).toHaveBeenCalledWith('payroll-boundary-a');
  });
});

describe('company payroll settings', () => {
  beforeEach(async () => {
    await resetPayrollTables();
    await seedUser('payroll-boundary-a');
    sessionUser.id = 'payroll-boundary-a';
    getSessionMock.mockClear();
    getRequestHeadersMock.mockClear();
    getUserRoleGroupMock.mockClear();
  });

  afterAll(resetPayrollTables);

  it('returns null when no settings row exists', async () => {
    serverFnProvider.handler = getCompanyPayrollSettingsFn_createServerFn_handler;
    const result = await getCompanyPayrollSettingsFn({ data: undefined } as never);
    expect(result).toBeNull();
  });

  it('returns the seeded company payroll settings', async () => {
    serverFnProvider.handler = getCompanyPayrollSettingsFn_createServerFn_handler;
    await db.insert(companyPayrollSettings).values({});
    const result = await getCompanyPayrollSettingsFn({ data: undefined } as never);
    expect(result).not.toBeNull();
    expect(result?.cut_off_day).toBe(7);
    expect(result?.pph21_enabled).toBe(true);
  });

  it('updates the company payroll settings', async () => {
    serverFnProvider.handler = updateCompanyPayrollSettingsFn_createServerFn_handler;
    await db.insert(companyPayrollSettings).values({});
    const result = await updateCompanyPayrollSettingsFn({
      data: { companyNpwp: '1234567890', cutOffDay: 15 }
    });
    expect(result.cut_off_day).toBe(15);
    expect(result.company_npwp).toBe('1234567890');
  });
});

describe('BPJS enrollment and family members', () => {
  beforeEach(async () => {
    await resetPayrollTables();
    sessionUser.id = 'payroll-boundary-a';
    getSessionMock.mockClear();
    getRequestHeadersMock.mockClear();
    getUserRoleGroupMock.mockClear();
  });

  afterAll(resetPayrollTables);

  it('upserts a BPJS enrollment, lists it, and manages its family members', async () => {
    await seedEmployee('payroll-boundary-a');

    serverFnProvider.handler = upsertEmployeeBpjsEnrollmentFn_createServerFn_handler;
    const created = await upsertEmployeeBpjsEnrollmentFn({
      data: {
        employeeId: 'payroll-boundary-a',
        program: 'jht',
        registeredWage: '5000000.00',
        effectiveFrom: '2026-01-01'
      }
    });
    expect(created.program).toBe('jht');
    expect(created.registered_wage).toBe('5000000.00');

    serverFnProvider.handler = listEmployeeBpjsEnrollmentsFn_createServerFn_handler;
    const listed = await listEmployeeBpjsEnrollmentsFn({
      data: { employeeId: 'payroll-boundary-a' }
    });
    expect(listed.enrollments).toHaveLength(1);
    expect(listed.enrollments[0].id).toBe(created.id);
    expect(listed.enrollments[0].familyMembers).toEqual([]);

    serverFnProvider.handler = createEmployeeBpjsFamilyMemberFn_createServerFn_handler;
    const member = await createEmployeeBpjsFamilyMemberFn({
      data: {
        enrollmentId: created.id,
        name: 'Jane Doe',
        relationship: 'spouse',
        isCore: true
      }
    });
    expect(member.enrollment_id).toBe(created.id);

    serverFnProvider.handler = listEmployeeBpjsEnrollmentsFn_createServerFn_handler;
    const withFamily = await listEmployeeBpjsEnrollmentsFn({
      data: { employeeId: 'payroll-boundary-a' }
    });
    expect(withFamily.enrollments[0].familyMembers).toEqual([
      expect.objectContaining({ id: member.id, name: 'Jane Doe', relationship: 'spouse' })
    ]);

    serverFnProvider.handler = deleteEmployeeBpjsFamilyMemberFn_createServerFn_handler;
    const deleted = await deleteEmployeeBpjsFamilyMemberFn({ data: { id: member.id } });
    expect(deleted).toBe(true);

    serverFnProvider.handler = listEmployeeBpjsEnrollmentsFn_createServerFn_handler;
    const afterDelete = await listEmployeeBpjsEnrollmentsFn({
      data: { employeeId: 'payroll-boundary-a' }
    });
    expect(afterDelete.enrollments[0].familyMembers).toEqual([]);
  });
});

describe('attendance override', () => {
  beforeEach(async () => {
    await resetPayrollTables();
    sessionUser.id = 'payroll-boundary-a';
    getSessionMock.mockClear();
    getRequestHeadersMock.mockClear();
    getUserRoleGroupMock.mockClear();
  });

  afterAll(resetPayrollTables);

  it('upserts an override and surfaces worked_hours and has_override on records', async () => {
    await seedEmployee('payroll-boundary-a');
    const [period] = await db
      .insert(payrollPeriods)
      .values({
        name: 'Override Draft Period',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        payment_date: '2026-08-05',
        status: 'draft'
      })
      .returning({ id: payrollPeriods.id });
    await db.insert(payrollRecords).values({
      payroll_period_id: period.id,
      employee_id: 'payroll-boundary-a',
      gross_salary: '100',
      net_salary: '90'
    });

    serverFnProvider.handler = upsertAttendanceOverrideFn_createServerFn_handler;
    const override = await upsertAttendanceOverrideFn({
      data: { payrollPeriodId: period.id, employeeId: 'payroll-boundary-a', workedHours: 40 }
    });
    expect(Number(override.worked_hours)).toBe(40);

    serverFnProvider.handler = listPayrollRecordsFn_createServerFn_handler;
    const result = await listPayrollRecordsFn({
      data: { payrollPeriodId: period.id }
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].has_override).toBe(true);
    expect(Number(result.rows[0].worked_hours)).toBe(40);
  });

  it('rejects upserting an override against a non-draft period', async () => {
    await seedEmployee('payroll-boundary-a');
    const [period] = await db
      .insert(payrollPeriods)
      .values({
        name: 'Override Paid Period',
        period_start: '2026-06-01',
        period_end: '2026-06-30',
        payment_date: '2026-07-05',
        status: 'paid'
      })
      .returning({ id: payrollPeriods.id });

    serverFnProvider.handler = upsertAttendanceOverrideFn_createServerFn_handler;
    await expect(
      upsertAttendanceOverrideFn({
        data: { payrollPeriodId: period.id, employeeId: 'payroll-boundary-a', workedHours: 40 }
      })
    ).rejects.toThrow();
  });
});

describe('tax record override', () => {
  beforeEach(async () => {
    await resetPayrollTables();
    sessionUser.id = 'payroll-boundary-a';
    getSessionMock.mockClear();
    getRequestHeadersMock.mockClear();
    getUserRoleGroupMock.mockClear();
  });

  afterAll(resetPayrollTables);

  it('flips a calculated tax record to a manual override', async () => {
    await seedEmployee('payroll-boundary-a');
    const [record] = await db
      .insert(employeeTaxRecords)
      .values({
        employee_id: 'payroll-boundary-a',
        tax_period: '2026-07-01',
        taxable_income: '10000000',
        tax_amount: '1000000'
      })
      .returning();
    expect(record.source).toBe('calculated');
    expect(record.is_overridden).toBe(false);

    serverFnProvider.handler = overrideEmployeeTaxRecordFn_createServerFn_handler;
    const updated = await overrideEmployeeTaxRecordFn({
      data: { id: record.id, amount: 500000 }
    });
    expect(updated.id).toBe(record.id);
    expect(updated.source).toBe('manual');
    expect(updated.is_overridden).toBe(true);
    expect(Number(updated.tax_amount)).toBe(500000);
  });
});

describe('payroll generation writes calculated tax records', () => {
  beforeEach(async () => {
    await resetPayrollTables();
    sessionUser.id = 'payroll-boundary-a';
    getSessionMock.mockClear();
    getRequestHeadersMock.mockClear();
    getUserRoleGroupMock.mockClear();
  });

  afterAll(resetPayrollTables);

  it('writes a calculated employee tax record for each generated payroll record', async () => {
    const { employee } = await seedEmployee('payroll-boundary-a');
    const [period] = await db
      .insert(payrollPeriods)
      .values({
        name: 'Generate Draft Period',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        payment_date: '2026-08-05',
        status: 'draft'
      })
      .returning({ id: payrollPeriods.id });
    const [taxSetting] = await db
      .insert(taxSettings)
      .values({
        code: 'TEST-PROGRESSIVE',
        name: 'Test progressive setting',
        rates: {
          method: 'progressive',
          ptkp: '4500000',
          progressive: [
            { upTo: '50000000', rate: '5' },
            { upTo: null, rate: '15' }
          ]
        },
        effective_from: '2026-01-01'
      })
      .returning({ id: taxSettings.id });
    await db.insert(employeeSalaryAssignments).values({
      employee_id: employee.id,
      salary_type: 'monthly',
      amount: '5000000',
      effective_from: '2026-01-01'
    });
    await db.insert(employeeTaxProfiles).values({
      employee_id: employee.id,
      tax_setting_id: taxSetting.id,
      tax_identifier: 'TAX-TEST-001',
      filing_status: 'single',
      ptkp_status: 'TK/0',
      effective_from: '2026-01-01'
    });

    serverFnProvider.handler = generatePayrollFn_createServerFn_handler;
    const created = await generatePayrollFn({ data: { payrollPeriodId: period.id } });

    expect(created).toHaveLength(1);
    const records = await db
      .select()
      .from(employeeTaxRecords)
      .where(eq(employeeTaxRecords.employee_id, employee.id));
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe('calculated');
    expect(records[0].is_overridden).toBe(false);
    expect(records[0].payroll_record_id).toBe(created[0].id);
    expect(records[0].tax_period).toBe('2026-07-01');
    expect(Number(records[0].taxable_income)).toBe(500000);
    expect(Number(records[0].tax_amount)).toBe(25000);
  });
});

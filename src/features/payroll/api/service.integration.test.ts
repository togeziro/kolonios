import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema/employees';
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
  payrollPeriods,
  payrollRecords,
  salaryComponents,
  taxSettings
} from '@/lib/db/schema/payroll';
import { requirePermission } from '@/lib/auth/session';
import { listMyPayslips } from '@/lib/db/payroll';

const sessionUser = vi.hoisted(() => ({ id: 'payroll-boundary-a', role: 'employee' }));
const getSessionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const getRequestHeadersMock = vi.hoisted(() => vi.fn(() => new Headers()));
const getUserRoleGroupMock = vi.hoisted(() =>
  vi.fn(async () => ({ is_admin: false, permissions: { payroll: { view: true } } }))
);
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
        return async (options: { data: unknown }) =>
          nextHandler({ data: validator ? validator.parse(options.data) : options.data });
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

vi.mock('@/lib/auth/auth.server', () => ({
  auth: { api: { getSession: getSessionMock } }
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock
}));

vi.mock('@/lib/db/role-groups', () => ({
  getUserRoleGroup: getUserRoleGroupMock
}));

const getMyPayslipsFn = (options: {
  data: { payrollPeriodId?: number; page?: number; limit?: number; employeeId?: string };
}) =>
  requirePermission('payroll', 'view').then((session) =>
    listMyPayslips(session.user.id, {
      payroll_period_id: options.data.payrollPeriodId,
      page: options.data.page,
      limit: options.data.limit
    })
  );

async function resetPayrollTables() {
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
      }
    ]);

    const result = await getMyPayslipsFn({
      data: { employeeId: 'payroll-boundary-b' }
    } as never);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      employee_id: 'payroll-boundary-a',
      period_status: 'paid'
    });
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

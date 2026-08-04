import { createServerFn } from '@tanstack/react-start';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema/employees';
import { employeeShifts, leaves } from '@/lib/db/schema/attendance';
import { taxSettings } from '@/lib/db/schema/payroll';
import {
  createSalaryComponent,
  deleteSalaryComponent,
  listSalaryComponents,
  updateSalaryComponent,
  createSalaryAssignment,
  createEmployeeSalaryComponent,
  createEmployeeTaxProfile,
  getEffectiveSalaryAssignment,
  getEffectiveSalaryComponents,
  getEffectiveTaxProfile,
  getEffectiveBenefits,
  getPrimaryBankAccount,
  getEmploymentContext,
  createPayrollPeriod,
  listPayrollPeriods,
  getPayrollPeriod,
  generatePayrollRecords,
  listPayrollRecords,
  transitionPayrollPeriod
} from '@/lib/db/payroll';
import { calculatePayroll, parseDbDecimalToMoney } from '../utils/calculator';
import type {
  AttendancePolicy,
  PayrollCalculationInput,
  SalaryComponentInput,
  TaxProfile
} from './types';
import {
  employeePayrollProfileReadSchema,
  employeePayrollProfileSchema,
  generatePayrollSchema,
  payrollPeriodFiltersSchema,
  payrollPeriodIdSchema,
  payrollPeriodSchema,
  payrollRecordFiltersSchema,
  reportFiltersSchema,
  salaryComponentIdSchema,
  salaryComponentSchema,
  salaryComponentUpdateSchema,
  myPayslipFiltersSchema
} from './validation';

const emptyPolicy: AttendancePolicy = {
  absence: { enabled: true },
  late: { mode: 'none' },
  unpaidLeave: { enabled: true },
  monthlyAttendanceMode: 'prorate'
};

async function audit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string | number,
  after: unknown
) {
  await withAudit(
    actor,
    { action, entityType, entityId, before: null, after },
    async () => undefined
  );
}

export function assertEmployeeScope(
  actor: { user: { id: string; role?: string | null } },
  employeeId: string
) {
  if (
    employeeId !== actor.user.id &&
    ['employee', 'technician', 'user'].includes(actor.user.role ?? '')
  ) {
    throw new Error('Forbidden: payroll employee scope required');
  }
}

export const listSalaryComponentsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('payroll', 'view');
  return listSalaryComponents();
});

export const createSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'add');
    const created = await createSalaryComponent({
      code: data.code,
      name: data.name,
      type: data.type,
      description: data.description ?? null,
      is_active: data.isActive
    });
    await audit(
      session.user.id,
      'payroll.salary_component.create',
      'salary_component',
      created.id,
      created
    );
    return created;
  });

export const updateSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentUpdateSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const updated = await updateSalaryComponent(data.id, {
      ...data.values,
      is_active: data.values.isActive,
      description: data.values.description
    });
    await audit(
      session.user.id,
      'payroll.salary_component.update',
      'salary_component',
      data.id,
      updated
    );
    return updated;
  });

export const deleteSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'delete');
    const deleted = await deleteSalaryComponent(data.id);
    await audit(
      session.user.id,
      'payroll.salary_component.delete',
      'salary_component',
      data.id,
      null
    );
    return deleted;
  });

export const getEmployeePayrollProfileFn = createServerFn({ method: 'GET' })
  .validator(employeePayrollProfileReadSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    assertEmployeeScope(session, data.employeeId);
    return JSON.parse(
      JSON.stringify({
        employment: await getEmploymentContext(
          data.employeeId,
          new Date().toISOString().slice(0, 10)
        ),
        assignment: await getEffectiveSalaryAssignment(data.employeeId, '1900-01-01', '9999-12-31'),
        components: await getEffectiveSalaryComponents(data.employeeId, '1900-01-01', '9999-12-31'),
        tax: await getEffectiveTaxProfile(data.employeeId, new Date().toISOString().slice(0, 10)),
        benefits: await getEffectiveBenefits(data.employeeId, '1900-01-01', '9999-12-31'),
        bank: await getPrimaryBankAccount(data.employeeId, new Date().toISOString().slice(0, 10))
      })
    );
  });

export const updateEmployeePayrollProfileFn = createServerFn({ method: 'POST' })
  .validator(employeePayrollProfileSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    assertEmployeeScope(session, data.employeeId);
    const values = data.values as Record<string, unknown>;
    let result: unknown;
    if (data.kind === 'assignment')
      result = await createSalaryAssignment({
        employee_id: data.employeeId,
        salary_type: values.salaryType as 'monthly' | 'daily' | 'hourly',
        amount: String(values.amount),
        effective_from: String(values.effectiveFrom),
        effective_to: values.effectiveTo == null ? null : String(values.effectiveTo),
        created_by: session.user.id
      });
    else if (data.kind === 'component')
      result = await createEmployeeSalaryComponent({
        assignment_id: Number(values.assignmentId),
        salary_component_id: Number(values.salaryComponentId),
        amount: String(values.amount),
        effective_from: String(values.effectiveFrom),
        effective_to: values.effectiveTo == null ? null : String(values.effectiveTo)
      });
    else if (data.kind === 'tax')
      result = await createEmployeeTaxProfile({
        employee_id: data.employeeId,
        tax_setting_id: values.taxSettingId == null ? null : Number(values.taxSettingId),
        tax_identifier: values.taxIdentifier == null ? null : String(values.taxIdentifier),
        filing_status: values.filingStatus == null ? null : String(values.filingStatus),
        effective_from: String(values.effectiveFrom),
        effective_to: values.effectiveTo == null ? null : String(values.effectiveTo)
      });
    else throw new Error(`Unsupported payroll profile section: ${data.kind}`);
    await audit(
      session.user.id,
      `payroll.profile.${data.kind}.update`,
      'employee_payroll_profile',
      data.employeeId,
      result
    );
    return JSON.parse(JSON.stringify(result));
  });

export const createPayrollPeriodFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'add');
    const created = await createPayrollPeriod({
      name: data.name,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      status: 'draft',
      created_by: session.user.id
    });
    await audit(session.user.id, 'payroll.period.create', 'payroll_period', created.id, created);
    return created;
  });

export const listPayrollPeriodsFn = createServerFn({ method: 'GET' })
  .validator(payrollPeriodFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('payroll', 'view');
    return listPayrollPeriods(data);
  });

function mapTaxProfile(
  profile: Awaited<ReturnType<typeof getEffectiveTaxProfile>>,
  setting: { rates: unknown } | null
): TaxProfile {
  const rates = (setting?.rates ?? {}) as Record<string, unknown>;
  const progressive = Array.isArray(rates.progressive) ? rates.progressive : [];
  const ter = typeof rates.ter === 'object' && rates.ter ? rates.ter : undefined;
  return {
    method: rates.method === 'ter' ? 'ter' : rates.method === 'none' ? 'none' : 'progressive',
    ptkp: parseDbDecimalToMoney(String(rates.ptkp ?? '0')),
    category: profile.filing_status ?? undefined,
    settings: {
      progressive: progressive as TaxProfile['settings'] extends { progressive?: infer T }
        ? T
        : never,
      ter: ter as TaxProfile['settings'] extends { ter?: infer T } ? T : never
    }
  };
}

async function buildPayrollRecord(
  employeeId: string,
  period: { id: number; period_start: string; period_end: string }
) {
  const assignment = await getEffectiveSalaryAssignment(
    employeeId,
    period.period_start,
    period.period_end
  );
  const componentRows = await getEffectiveSalaryComponents(
    employeeId,
    period.period_start,
    period.period_end
  );
  const tax = await getEffectiveTaxProfile(employeeId, period.period_start);
  const setting = tax.tax_setting_id
    ? ((
        await db
          .select({ rates: taxSettings.rates })
          .from(taxSettings)
          .where(eq(taxSettings.id, tax.tax_setting_id))
          .limit(1)
      )[0] ?? null)
    : null;
  const attendanceRows = await db
    .select()
    .from(employeeShifts)
    .where(
      and(
        eq(employeeShifts.user_id, employeeId),
        gte(employeeShifts.date, period.period_start),
        lte(employeeShifts.date, period.period_end)
      )
    );
  const approvedLeave = await db
    .select({ days: sql<number>`coalesce(sum(${leaves.total_days}), 0)` })
    .from(leaves)
    .where(
      and(
        eq(leaves.user_id, employeeId),
        eq(leaves.status, 'approved'),
        lte(leaves.start_date, period.period_end),
        gte(leaves.end_date, period.period_start)
      )
    );
  const attendance = {
    scheduledDays: Math.max(attendanceRows.length, 1),
    payableDays: attendanceRows.filter((row) =>
      ['present', 'late', 'excused'].includes(row.attendance_status)
    ).length,
    workedHours: attendanceRows.filter((row) => row.check_in_time && row.check_out_time).length * 8,
    absentDays: attendanceRows.filter((row) => row.attendance_status === 'absent').length,
    lateCount: attendanceRows.filter((row) => row.attendance_status === 'late').length,
    unpaidLeaveDays: Number(approvedLeave[0]?.days ?? 0)
  };
  const input: PayrollCalculationInput = {
    salary: { type: assignment.salary_type, amount: parseDbDecimalToMoney(assignment.amount) },
    attendance,
    attendancePolicy: emptyPolicy,
    components: componentRows.map(
      ({ component, definition }) =>
        ({
          name: definition?.name ?? `Component ${component.salary_component_id}`,
          type: definition?.type ?? 'allowance',
          mode: 'fixed',
          amount: parseDbDecimalToMoney(component.amount),
          taxable: definition?.type === 'allowance'
        }) as SalaryComponentInput
    ),
    manualAdjustments: [],
    tax: mapTaxProfile(tax, setting)
  };
  const result = calculatePayroll(input);
  return {
    payroll_period_id: period.id,
    employee_id: employeeId,
    gross_salary: (result.grossSalary / 100).toFixed(2),
    total_allowances: (result.allowanceTotal / 100).toFixed(2),
    total_deductions: (result.deductionTotal / 100).toFixed(2),
    net_salary: (result.netSalary / 100).toFixed(2),
    details: result.snapshot
  };
}

export const generatePayrollFn = createServerFn({ method: 'POST' })
  .validator(generatePayrollSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    await checkRateLimit(`payroll:generate:${session.user.id}`);
    const period = await getPayrollPeriod(data.payrollPeriodId);
    if (!period) throw new Error('Payroll period was not found');
    const activeEmployees = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.status, 'active'));
    const records = [];
    for (const employee of activeEmployees)
      records.push(await buildPayrollRecord(employee.id, period));
    const generated = await generatePayrollRecords(period.id, records);
    await audit(session.user.id, 'payroll.generate', 'payroll_period', period.id, {
      count: generated.length
    });
    return JSON.parse(JSON.stringify(generated));
  });

export const listPayrollRecordsFn = createServerFn({ method: 'GET' })
  .validator(payrollRecordFiltersSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    const employeeId = data.scope === 'employee' ? session.user.id : data.employeeId;
    if (data.scope === 'employee') assertEmployeeScope(session, session.user.id);
    return JSON.parse(
      JSON.stringify(
        await listPayrollRecords({
          payroll_period_id: data.payrollPeriodId,
          employee_id: employeeId,
          department_id: data.departmentId,
          status: data.status,
          scope: data.scope ?? 'admin',
          page: data.page,
          limit: data.limit
        })
      )
    );
  });

export const approvePayrollFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'approve');
    const updated = await transitionPayrollPeriod(data.id, 'ready_to_pay');
    await audit(session.user.id, 'payroll.approve', 'payroll_period', data.id, updated);
    return updated;
  });
export const markPayrollPaidFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'pay');
    await checkRateLimit(`payroll:payment:${session.user.id}`);
    const updated = await transitionPayrollPeriod(data.id, 'paid');
    await audit(session.user.id, 'payroll.pay', 'payroll_period', data.id, updated);
    return updated;
  });
export const lockPayrollFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const updated = await transitionPayrollPeriod(data.id, 'locked');
    await audit(session.user.id, 'payroll.lock', 'payroll_period', data.id, updated);
    return updated;
  });
export const getMyPayslipsFn = createServerFn({ method: 'GET' })
  .validator(myPayslipFiltersSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    return JSON.parse(
      JSON.stringify(
        await listPayrollRecords({
          payroll_period_id: data.payrollPeriodId,
          employee_id: session.user.id,
          scope: 'employee',
          page: data.page,
          limit: data.limit
        })
      )
    );
  });
export const getPayrollReportFn = createServerFn({ method: 'GET' })
  .validator(reportFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('payroll', 'reports');
    return JSON.parse(
      JSON.stringify(
        await listPayrollRecords({
          payroll_period_id: data.payrollPeriodId,
          employee_id: data.employeeId,
          department_id: data.departmentId,
          status: data.status,
          scope: 'admin',
          page: data.page,
          limit: data.limit
        })
      )
    );
  });

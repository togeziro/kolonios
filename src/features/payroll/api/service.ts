import { createServerFn } from '@tanstack/react-start';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { employees } from '@/lib/db/schema/employees';
import {
  dateOverrides,
  dayOffs,
  employeeShifts,
  leaves,
  scheduleAssignments,
  shiftWeekdayRules
} from '@/lib/db/schema/attendance';
import {
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  payrollPeriods,
  payrollRecords,
  salaryComponents,
  taxSettings
} from '@/lib/db/schema/payroll';
import {
  listSalaryComponents,
  getEffectiveSalaryAssignment,
  getEffectiveSalaryComponents,
  getEffectiveTaxProfile,
  getEffectiveBenefits,
  getPrimaryBankAccount,
  getEmploymentContext,
  listPayrollPeriods,
  listPayrollRecords,
  withPayrollAuditTransaction,
  lockPayrollPeriod,
  assertPayrollTransition,
  type PayrollTransaction
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

export function assertProfileReferenceScope(
  actor: { user: { id: string; role?: string | null } },
  employeeId: string,
  referencedEmployeeId: string
) {
  assertEmployeeScope(actor, employeeId);
  if (referencedEmployeeId !== employeeId) {
    throw new Error('Forbidden: payroll profile reference belongs to another employee');
  }
}

export function resolvePayrollRecordScope(
  actor: { user: { id: string; role?: string | null } },
  filters: { scope?: 'admin' | 'employee'; employeeId?: string }
) {
  const staffRole = ['employee', 'technician', 'user'].includes(actor.user.role ?? '');
  if (staffRole) {
    if (filters.employeeId && filters.employeeId !== actor.user.id)
      assertEmployeeScope(actor, filters.employeeId);
    return { scope: 'employee' as const, employeeId: actor.user.id };
  }
  return {
    scope: filters.scope === 'employee' ? ('employee' as const) : ('admin' as const),
    employeeId: filters.scope === 'employee' ? actor.user.id : filters.employeeId
  };
}

function parseTaxRate(value: unknown, name: string) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+(?:\.\d+)?$/.test(text))
    throw new Error(`Invalid tax rate: ${name}`);
  const rate = Number(text);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100)
    throw new Error(`Invalid tax rate: ${name}`);
  return rate;
}

function parseTaxMoney(value: unknown, name: string) {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error(`Invalid tax amount: ${name}`);
  try {
    return parseDbDecimalToMoney(typeof value === 'number' ? value.toFixed(2) : value);
  } catch {
    throw new Error(`Invalid tax amount: ${name}`);
  }
}

export function mapTaxProfile(
  profile: Awaited<ReturnType<typeof getEffectiveTaxProfile>>,
  setting: { rates: unknown } | null
): TaxProfile {
  const rates = setting?.rates;
  if (rates == null || typeof rates !== 'object' || Array.isArray(rates)) {
    if (!setting) return { method: 'none', ptkp: 0, settings: {} };
    throw new Error('Invalid tax settings JSON');
  }
  const raw = rates as Record<string, unknown>;
  const method = raw.method;
  if (method !== 'none' && method !== 'progressive' && method !== 'ter')
    throw new Error('Invalid tax method');
  const progressive = raw.progressive;
  const parsedProgressive =
    progressive == null
      ? undefined
      : (() => {
          if (!Array.isArray(progressive)) throw new Error('Invalid progressive tax brackets');
          return progressive.map((bracket, index) => {
            if (!bracket || typeof bracket !== 'object' || Array.isArray(bracket))
              throw new Error(`Invalid progressive bracket: ${index}`);
            const item = bracket as Record<string, unknown>;
            return {
              upTo:
                item.upTo == null ? null : parseTaxMoney(item.upTo, `progressive[${index}].upTo`),
              rate: parseTaxRate(item.rate, `progressive[${index}].rate`)
            };
          });
        })();
  const ter = raw.ter;
  const parsedTer =
    ter == null
      ? undefined
      : (() => {
          if (typeof ter !== 'object' || Array.isArray(ter))
            throw new Error('Invalid TER tax categories');
          return Object.fromEntries(
            Object.entries(ter).map(([category, brackets]) => {
              if (!category.trim() || !Array.isArray(brackets))
                throw new Error(`Invalid TER category: ${category}`);
              return [
                category,
                brackets.map((bracket, index) => {
                  if (!bracket || typeof bracket !== 'object' || Array.isArray(bracket))
                    throw new Error(`Invalid TER bracket: ${category}[${index}]`);
                  const item = bracket as Record<string, unknown>;
                  return {
                    upTo:
                      item.upTo == null
                        ? null
                        : parseTaxMoney(item.upTo, `ter.${category}[${index}].upTo`),
                    rate: parseTaxRate(item.rate, `ter.${category}[${index}].rate`)
                  };
                })
              ];
            })
          );
        })();
  const ptkp =
    method === 'none' ? parseTaxMoney(raw.ptkp ?? '0', 'ptkp') : parseTaxMoney(raw.ptkp, 'ptkp');
  const category = profile.filing_status ?? undefined;
  if (method === 'ter' && parsedTer && category && !parsedTer[category])
    throw new Error(`Missing TER category: ${category}`);
  return { method, ptkp, category, settings: { progressive: parsedProgressive, ter: parsedTer } };
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function overlapDays(start: string, end: string, periodStart: string, periodEnd: string) {
  const from = dateOnly(start) > dateOnly(periodStart) ? dateOnly(start) : dateOnly(periodStart);
  const to = dateOnly(end) < dateOnly(periodEnd) ? dateOnly(end) : dateOnly(periodEnd);
  return to < from ? 0 : Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export function buildAttendanceTotals(
  attendanceRows: Array<{
    date: string;
    attendance_status: string;
    check_in_time: string | null;
    check_out_time: string | null;
  }>,
  leaveRows: Array<{ start_date: string; end_date: string; total_days: number; status: string }>,
  context: {
    periodStart?: string;
    periodEnd?: string;
    scheduledDays: number;
    payableDays: number;
    absentDays: number;
  }
) {
  const validRows = attendanceRows.filter((row) => row.attendance_status !== 'pending');
  const workedHours = validRows.reduce((total, row) => {
    if (!row.check_in_time || !row.check_out_time) return total;
    const [inHour, inMinute] = row.check_in_time.split(':').map(Number);
    const [outHour, outMinute] = row.check_out_time.split(':').map(Number);
    return total + Math.max(0, outHour * 60 + outMinute - inHour * 60 - inMinute) / 60;
  }, 0);
  const unpaidLeaveDays =
    context.periodStart && context.periodEnd
      ? leaveRows
          .filter((row) => row.status === 'approved')
          .reduce(
            (total, row) =>
              total +
              (overlapDays(row.start_date, row.end_date, context.periodStart!, context.periodEnd!) /
                Math.max(
                  1,
                  Math.round(
                    (dateOnly(row.end_date).getTime() - dateOnly(row.start_date).getTime()) /
                      86_400_000
                  ) + 1
                )) *
                row.total_days,
            0
          )
      : 0;
  return {
    scheduledDays: context.scheduledDays,
    payableDays:
      validRows.filter((row) => ['present', 'late', 'excused'].includes(row.attendance_status))
        .length || context.payableDays,
    workedHours,
    absentDays:
      validRows.filter((row) => row.attendance_status === 'absent').length || context.absentDays,
    lateCount: validRows.filter((row) => row.attendance_status === 'late').length,
    unpaidLeaveDays
  };
}

export function serializePayrollReport(
  result: { rows: Array<Record<string, unknown>> },
  format: 'json' | 'csv'
) {
  if (format === 'json') return result;
  const headers = [...new Set(result.rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return {
    ...result,
    format,
    mime: 'text/csv',
    content: [
      headers.join(','),
      ...result.rows.map((row) => headers.map((header) => escape(row[header])).join(','))
    ].join('\n')
  };
}

export const listSalaryComponentsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('payroll', 'view');
  return listSalaryComponents();
});

export const createSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'add');
    const created = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.salary_component.create', entityType: 'salary_component' },
      async (tx) => {
        const [row] = await tx
          .insert(salaryComponents)
          .values({
            code: data.code,
            name: data.name,
            type: data.type,
            description: data.description ?? null,
            is_active: data.isActive
          })
          .returning();
        if (!row) throw new Error('Failed to create salary component.');
        return row;
      }
    );
    return created;
  });

export const updateSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentUpdateSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const updated = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.salary_component.update',
        entityType: 'salary_component',
        entityId: data.id
      },
      async (tx) => {
        const [row] = await tx
          .update(salaryComponents)
          .set({
            code: data.values.code,
            name: data.values.name,
            type: data.values.type,
            description: data.values.description,
            is_active: data.values.isActive,
            updated_at: new Date()
          })
          .where(eq(salaryComponents.id, data.id))
          .returning();
        if (!row) throw new Error('Salary component was not found.');
        return row;
      }
    );
    return updated;
  });

export const deleteSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'delete');
    const deleted = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.salary_component.delete',
        entityType: 'salary_component',
        entityId: data.id
      },
      async (tx) =>
        (await tx.delete(salaryComponents).where(eq(salaryComponents.id, data.id)).returning())
          .length > 0
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
    const result = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: `payroll.profile.${data.kind}.update`,
        entityType: 'employee_payroll_profile',
        entityId: data.employeeId
      },
      async (tx) => {
        if (data.kind === 'assignment') {
          const values = {
            employee_id: data.employeeId,
            salary_type: data.values.salaryType,
            amount: data.values.amount,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null,
            department_id: data.values.departmentId ?? null,
            designation_id: data.values.designationId ?? null,
            created_by: session.user.id
          };
          if (data.values.id) {
            const [row] = await tx
              .update(employeeSalaryAssignments)
              .set({
                ...values,
                employee_id: undefined,
                created_by: undefined,
                updated_at: new Date()
              })
              .where(
                and(
                  eq(employeeSalaryAssignments.id, data.values.id),
                  eq(employeeSalaryAssignments.employee_id, data.employeeId)
                )
              )
              .returning();
            if (!row) throw new Error('Salary assignment was not found.');
            return row;
          }
          const [row] = await tx.insert(employeeSalaryAssignments).values(values).returning();
          if (!row) throw new Error('Failed to create salary assignment.');
          return row;
        }
        if (data.kind === 'component') {
          const [assignment] = await tx
            .select({ employee_id: employeeSalaryAssignments.employee_id })
            .from(employeeSalaryAssignments)
            .where(eq(employeeSalaryAssignments.id, data.values.assignmentId))
            .limit(1);
          if (!assignment) throw new Error('Salary assignment was not found.');
          assertProfileReferenceScope(session, data.employeeId, assignment.employee_id);
          const [definition] = await tx
            .select({ id: salaryComponents.id })
            .from(salaryComponents)
            .where(eq(salaryComponents.id, data.values.salaryComponentId))
            .limit(1);
          if (!definition) throw new Error('Salary component was not found.');
          const values = {
            assignment_id: data.values.assignmentId,
            salary_component_id: data.values.salaryComponentId,
            amount: data.values.amount,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null
          };
          if (data.values.id) {
            const [existing] = await tx
              .select({
                assignment_id: employeeSalaryComponents.assignment_id,
                salary_component_id: employeeSalaryComponents.salary_component_id
              })
              .from(employeeSalaryComponents)
              .where(eq(employeeSalaryComponents.id, data.values.id))
              .limit(1);
            if (!existing) throw new Error('Employee salary component was not found.');
            if (
              existing.assignment_id !== data.values.assignmentId ||
              existing.salary_component_id !== data.values.salaryComponentId
            ) {
              throw new Error('Salary component identity is immutable.');
            }
            const [row] = await tx
              .update(employeeSalaryComponents)
              .set({
                amount: values.amount,
                effective_from: values.effective_from,
                effective_to: values.effective_to,
                updated_at: new Date()
              })
              .where(eq(employeeSalaryComponents.id, data.values.id))
              .returning();
            if (!row) throw new Error('Employee salary component was not found.');
            return row;
          }
          const [row] = await tx.insert(employeeSalaryComponents).values(values).returning();
          if (!row) throw new Error('Failed to create employee salary component.');
          return row;
        }
        if (data.kind === 'tax') {
          const values = {
            employee_id: data.employeeId,
            tax_setting_id: data.values.taxSettingId ?? null,
            tax_identifier: data.values.taxIdentifier ?? null,
            filing_status: data.values.filingStatus ?? null,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null
          };
          if (data.values.id) {
            const [row] = await tx
              .update(employeeTaxProfiles)
              .set({ ...values, employee_id: undefined, updated_at: new Date() })
              .where(
                and(
                  eq(employeeTaxProfiles.id, data.values.id),
                  eq(employeeTaxProfiles.employee_id, data.employeeId)
                )
              )
              .returning();
            if (!row) throw new Error('Tax profile was not found.');
            return row;
          }
          const [row] = await tx.insert(employeeTaxProfiles).values(values).returning();
          if (!row) throw new Error('Failed to create tax profile.');
          return row;
        }
        if (data.kind === 'benefit') {
          const values = {
            employee_id: data.employeeId,
            benefit_code: data.values.benefitCode,
            benefit_name: data.values.benefitName,
            amount: data.values.amount ?? null,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null,
            status: data.values.status
          };
          if (data.values.id) {
            const [row] = await tx
              .update(employeeBenefitEnrollments)
              .set({ ...values, employee_id: undefined, updated_at: new Date() })
              .where(
                and(
                  eq(employeeBenefitEnrollments.id, data.values.id),
                  eq(employeeBenefitEnrollments.employee_id, data.employeeId)
                )
              )
              .returning();
            if (!row) throw new Error('Benefit enrollment was not found.');
            return row;
          }
          const [row] = await tx.insert(employeeBenefitEnrollments).values(values).returning();
          if (!row) throw new Error('Failed to create benefit enrollment.');
          return row;
        }
        const values = {
          employee_id: data.employeeId,
          bank_name: data.values.bankName,
          account_name: data.values.accountName,
          account_number: data.values.accountNumber,
          is_primary: data.values.isPrimary,
          effective_from: data.values.effectiveFrom,
          effective_to: data.values.effectiveTo ?? null
        };
        if (data.values.id) {
          const [row] = await tx
            .update(employeeBankAccounts)
            .set({ ...values, employee_id: undefined, updated_at: new Date() })
            .where(
              and(
                eq(employeeBankAccounts.id, data.values.id),
                eq(employeeBankAccounts.employee_id, data.employeeId)
              )
            )
            .returning();
          if (!row) throw new Error('Bank account was not found.');
          return row;
        }
        const [row] = await tx.insert(employeeBankAccounts).values(values).returning();
        if (!row) throw new Error('Failed to create bank account.');
        return row;
      }
    );
    return JSON.parse(JSON.stringify(result));
  });

export const createPayrollPeriodFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'add');
    const created = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.period.create', entityType: 'payroll_period' },
      async (tx) => {
        const [row] = await tx
          .insert(payrollPeriods)
          .values({
            name: data.name,
            period_start: data.periodStart,
            period_end: data.periodEnd,
            status: 'draft',
            created_by: session.user.id
          })
          .returning();
        if (!row) throw new Error('Failed to create payroll period.');
        return row;
      }
    );
    return created;
  });

export const listPayrollPeriodsFn = createServerFn({ method: 'GET' })
  .validator(payrollPeriodFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('payroll', 'view');
    return listPayrollPeriods(data);
  });

async function getScheduledDays(
  tx: PayrollTransaction,
  employeeId: string,
  periodStart: string,
  periodEnd: string
) {
  const assignments = await tx
    .select()
    .from(scheduleAssignments)
    .where(
      and(
        eq(scheduleAssignments.user_id, employeeId),
        lte(scheduleAssignments.effective_from, periodEnd),
        sql`${scheduleAssignments.effective_to} is null or ${scheduleAssignments.effective_to} >= ${periodStart}`
      )
    );
  const rules = await tx.select().from(shiftWeekdayRules);
  const overrides = await tx
    .select()
    .from(dateOverrides)
    .where(
      and(
        eq(dateOverrides.user_id, employeeId),
        gte(dateOverrides.date, periodStart),
        lte(dateOverrides.date, periodEnd)
      )
    );
  const daysOff = await tx
    .select({ date: dayOffs.date })
    .from(dayOffs)
    .where(
      and(
        eq(dayOffs.user_id, employeeId),
        gte(dayOffs.date, periodStart),
        lte(dayOffs.date, periodEnd)
      )
    );
  const overrideByDate = new Map(overrides.map((row: any) => [row.date, row.shift_id]));
  const daysOffSet = new Set(daysOff.map((row: any) => row.date));
  let scheduledDays = 0;
  for (
    let cursor = dateOnly(periodStart);
    cursor <= dateOnly(periodEnd);
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    if (daysOffSet.has(date)) continue;
    const assignment = assignments.find(
      (row: any) => row.effective_from <= date && (!row.effective_to || row.effective_to >= date)
    );
    const shiftId = overrideByDate.get(date) ?? assignment?.shift_id;
    const rule = rules.find(
      (row: any) => row.shift_id === shiftId && row.day_of_week === cursor.getUTCDay()
    );
    if (rule?.is_working_day) scheduledDays += 1;
  }
  return scheduledDays;
}

async function buildPayrollRecord(
  employeeId: string,
  period: { id: number; period_start: string; period_end: string },
  tx: PayrollTransaction
) {
  const assignment = await getEffectiveSalaryAssignment(
    employeeId,
    period.period_start,
    period.period_end,
    tx
  );
  const componentRows = await getEffectiveSalaryComponents(
    employeeId,
    period.period_start,
    period.period_end,
    tx
  );
  const tax = await getEffectiveTaxProfile(employeeId, period.period_start, tx);
  const setting = tax.tax_setting_id
    ? ((
        await tx
          .select({ rates: taxSettings.rates })
          .from(taxSettings)
          .where(eq(taxSettings.id, tax.tax_setting_id))
          .limit(1)
      )[0] ?? null)
    : null;
  const attendanceRows = await tx
    .select()
    .from(employeeShifts)
    .where(
      and(
        eq(employeeShifts.user_id, employeeId),
        gte(employeeShifts.date, period.period_start),
        lte(employeeShifts.date, period.period_end)
      )
    );
  const leaveRows = await tx
    .select({
      start_date: leaves.start_date,
      end_date: leaves.end_date,
      total_days: leaves.total_days,
      status: leaves.status
    })
    .from(leaves)
    .where(
      and(
        eq(leaves.user_id, employeeId),
        lte(leaves.start_date, period.period_end),
        gte(leaves.end_date, period.period_start)
      )
    );
  const scheduledDays = await getScheduledDays(
    tx,
    employeeId,
    period.period_start,
    period.period_end
  );
  const attendance = buildAttendanceTotals(attendanceRows, leaveRows, {
    periodStart: period.period_start,
    periodEnd: period.period_end,
    scheduledDays,
    payableDays: 0,
    absentDays: 0
  });
  const input: PayrollCalculationInput = {
    salary: { type: assignment.salary_type, amount: parseDbDecimalToMoney(assignment.amount) },
    attendance,
    attendancePolicy: emptyPolicy,
    components: componentRows.map(
      ({ component, definition }: any) =>
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
    const generated = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.generate', entityType: 'payroll_period', entityId: data.payrollPeriodId },
      async (tx) => {
        const period = await lockPayrollPeriod(tx, data.payrollPeriodId);
        if (!period) throw new Error('Payroll period was not found');
        assertPayrollTransition(period.status, 'processing');
        const activeEmployees = await tx
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.status, 'active'));
        const records = [];
        for (const employee of activeEmployees)
          records.push(await buildPayrollRecord(employee.id, period, tx));
        const created = [];
        for (const record of records) {
          const [duplicate] = await tx
            .select({ id: payrollRecords.id })
            .from(payrollRecords)
            .where(
              and(
                eq(payrollRecords.payroll_period_id, period.id),
                eq(payrollRecords.employee_id, record.employee_id)
              )
            )
            .limit(1);
          if (duplicate) throw new Error('Duplicate payroll record for this employee and period.');
          const [row] = await tx.insert(payrollRecords).values(record).returning();
          if (!row) throw new Error('Failed to create payroll record.');
          created.push(row);
        }
        const [updatedPeriod] = await tx
          .update(payrollPeriods)
          .set({ status: 'processing', updated_at: new Date() })
          .where(and(eq(payrollPeriods.id, period.id), eq(payrollPeriods.status, period.status)))
          .returning();
        if (!updatedPeriod) throw new Error('Payroll period changed during generation.');
        return created;
      }
    );
    return JSON.parse(JSON.stringify(generated));
  });

export const listPayrollRecordsFn = createServerFn({ method: 'GET' })
  .validator(payrollRecordFiltersSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    const scope = resolvePayrollRecordScope(session, data);
    return JSON.parse(
      JSON.stringify(
        await listPayrollRecords({
          payroll_period_id: data.payrollPeriodId,
          employee_id: scope.employeeId,
          department_id: data.departmentId,
          status: data.status,
          scope: scope.scope,
          page: data.page,
          limit: data.limit
        })
      )
    );
  });

async function transitionPayrollWithAudit(
  actorUserId: string,
  id: number,
  nextStatus: 'processing' | 'ready_to_pay' | 'paid' | 'locked',
  action: string
) {
  return withPayrollAuditTransaction(
    actorUserId,
    { action, entityType: 'payroll_period', entityId: id },
    async (tx) => {
      const period = await lockPayrollPeriod(tx, id);
      if (!period) throw new Error('Payroll period was not found.');
      assertPayrollTransition(period.status, nextStatus);
      const [row] = await tx
        .update(payrollPeriods)
        .set({
          status: nextStatus,
          processed_at: nextStatus === 'ready_to_pay' ? new Date() : period.processed_at,
          paid_at: nextStatus === 'paid' ? new Date() : period.paid_at,
          updated_at: new Date()
        })
        .where(and(eq(payrollPeriods.id, id), eq(payrollPeriods.status, period.status)))
        .returning();
      if (!row) throw new Error('Payroll period changed during transition.');
      return row;
    }
  );
}

export const approvePayrollFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'approve');
    return transitionPayrollWithAudit(session.user.id, data.id, 'ready_to_pay', 'payroll.approve');
  });
export const markPayrollPaidFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'pay');
    await checkRateLimit(`payroll:payment:${session.user.id}`);
    return transitionPayrollWithAudit(session.user.id, data.id, 'paid', 'payroll.pay');
  });
export const lockPayrollFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return transitionPayrollWithAudit(session.user.id, data.id, 'locked', 'payroll.lock');
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
    const result = await listPayrollRecords({
      payroll_period_id: data.payrollPeriodId,
      employee_id: data.employeeId,
      department_id: data.departmentId,
      status: data.status,
      scope: 'admin',
      page: data.page,
      limit: data.limit
    });
    return serializePayrollReport(JSON.parse(JSON.stringify(result)), data.format) as any;
  });

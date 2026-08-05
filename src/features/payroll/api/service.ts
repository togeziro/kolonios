import { createServerFn } from '@tanstack/react-start';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { employees } from '@/lib/db/schema/employees';
import {
  dateOverrides,
  dayOffs,
  employeeShifts,
  leaves,
  leaveTypeConfigs,
  scheduleAssignments,
  shiftWeekdayRules
} from '@/lib/db/schema/attendance';
import {
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeEmploymentEvents,
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
  getEffectiveSalaryComponents,
  getEffectiveTaxProfile,
  getEmploymentContext,
  getPrimaryBankAccount,
  listEmployeePayrollProfileHistory,
  listMyPayslips,
  listPayrollPeriods,
  listPayrollRecords,
  listPayrollReportRows,
  resolveEffectiveRecord,
  withPayrollAuditTransaction,
  lockPayrollPeriod,
  assertPayrollTransition,
  type PayrollTransaction
} from '@/lib/db/payroll';
import { calculatePayroll, parseDbDecimalToMoney } from '../utils/calculator';
import type {
  AttendancePolicy,
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollProfileActor,
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
  payrollRecordAdjustmentSchema,
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

export interface CompanyProfile {
  name: string;
  address?: string;
}

export function getCompanyProfile(): CompanyProfile {
  const name = process.env.COMPANY_NAME?.trim();
  const address = process.env.COMPANY_ADDRESS?.trim();
  return {
    name: name || 'Kolonios',
    ...(address ? { address } : {})
  };
}

export function assertEmployeeScope(actor: PayrollProfileActor, employeeId: string) {
  if (
    employeeId !== actor.user.id &&
    ['employee', 'technician', 'user'].includes(actor.user.role ?? '')
  ) {
    throw new DomainError('Forbidden: payroll employee scope required', 'FORBIDDEN');
  }
}

export function assertProfileReferenceScope(
  actor: PayrollProfileActor,
  employeeId: string,
  referencedEmployeeId: string
) {
  assertEmployeeScope(actor, employeeId);
  if (referencedEmployeeId !== employeeId) {
    throw new DomainError(
      'Forbidden: payroll profile reference belongs to another employee',
      'FORBIDDEN'
    );
  }
}

export function mapSalaryComponent(
  component: {
    amount: string;
    mode: 'fixed' | 'percentage' | 'per-attendance' | string;
    percentage_base: string | null;
    attendance_metric: string | null;
    taxable: boolean;
  },
  definition: { name?: string; type?: 'allowance' | 'deduction' } | null,
  componentId: number
): SalaryComponentInput {
  const mode = ['fixed', 'percentage', 'per-attendance'].includes(component.mode)
    ? (component.mode as SalaryComponentInput['mode'])
    : 'fixed';
  const percentageBase =
    component.percentage_base === 'gross-salary' ? 'gross-salary' : 'base-salary';
  const attendanceMetric = ['worked-hours', 'late-count', 'payable-days'].includes(
    component.attendance_metric ?? ''
  )
    ? (component.attendance_metric as SalaryComponentInput['attendanceMetric'])
    : 'payable-days';
  const amount =
    mode === 'percentage' ? Number(component.amount) : parseDbDecimalToMoney(component.amount);
  if (!Number.isFinite(amount) || amount < 0 || (mode === 'percentage' && amount > 100))
    throw new DomainError('Salary component amount is invalid.', 'INVALID_PAYROLL_DATA');
  return {
    name: definition?.name ?? `Component ${componentId}`,
    type: definition?.type ?? 'allowance',
    mode,
    amount,
    percentageBase,
    attendanceMetric,
    taxable: component.taxable
  };
}

export function sanitizePayrollProfileForActor<T extends Record<string, unknown>>(
  actor: PayrollProfileActor,
  profile: T
): T {
  if (!['employee', 'technician', 'user'].includes(actor.user.role ?? '')) return profile;
  const json = JSON.parse(JSON.stringify(profile)) as T;
  const record = json as Record<string, unknown>;
  const mask = (value: unknown) =>
    typeof value === 'string' && value.length > 4 ? `******${value.slice(-4)}` : null;
  const taxProfiles = Array.isArray(record.taxProfiles) ? record.taxProfiles : [];
  for (const item of taxProfiles) {
    if (item && typeof item === 'object') delete (item as Record<string, unknown>).tax_identifier;
  }
  if (record.tax && typeof record.tax === 'object')
    delete (record.tax as Record<string, unknown>).tax_identifier;
  const bankAccounts = Array.isArray(record.bankAccounts) ? record.bankAccounts : [];
  for (const item of bankAccounts) {
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      row.account_number = mask(row.account_number);
    }
  }
  if (record.bank && typeof record.bank === 'object') {
    const bank = record.bank as Record<string, unknown>;
    bank.account_number = mask(bank.account_number);
  }
  return json;
}

export function payrollPeriodBoundaries(
  periodStart: string,
  periodEnd: string,
  effectiveDates: string[]
) {
  return [
    periodStart,
    ...effectiveDates.filter((date) => date > periodStart && date <= periodEnd)
  ].toSorted();
}

export function closeEffectiveRecordAt(existingFrom: string, nextFrom: string) {
  if (existingFrom >= nextFrom)
    throw new DomainError(
      'New effective payroll records must start after the record they replace.',
      'HISTORICAL_RECORD_IMMUTABLE'
    );
  return previousDate(nextFrom);
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
    throw new DomainError(`Missing TER category: ${category}`, 'INVALID_TAX_SETTINGS');
  return { method, ptkp, category, settings: { progressive: parsedProgressive, ter: parsedTer } };
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function previousDate(value: string) {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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
  leaveRows: Array<{
    start_date: string;
    end_date: string;
    total_days: number;
    status: string;
    is_paid?: boolean;
  }>,
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
          .filter((row) => row.status === 'approved' && row.is_paid === false)
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
    encoding: 'identity' as const,
    ext: 'csv',
    content: [
      headers.join(','),
      ...result.rows.map((row) => headers.map((header) => escape(row[header])).join(','))
    ].join('\n')
  };
}

export function assertPayrollAdjustmentAllowed(status: string) {
  if (status !== 'processing') {
    throw new Error('Manual adjustments are only allowed before payroll approval.');
  }
}

type PayrollReportRow = {
  employee_id: string;
  department_name?: string | null;
  gross_salary: string | number;
  total_allowances: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  details?: unknown;
};

export function aggregatePayrollRows(rows: PayrollReportRow[]) {
  const departmentsByName = new Map<string, { department: string; gross: number; net: number }>();
  const componentsByKey = new Map<string, { name: string; type: string; amount: number }>();
  let gross = 0;
  let allowances = 0;
  let deductions = 0;
  let net = 0;
  let taxTotal = 0;
  for (const row of rows) {
    const rowGross = Number(row.gross_salary ?? 0);
    const rowNet = Number(row.net_salary ?? 0);
    gross += rowGross;
    allowances += Number(row.total_allowances ?? 0);
    deductions += Number(row.total_deductions ?? 0);
    net += rowNet;
    const department = row.department_name ?? 'Unassigned';
    const departmentTotal = departmentsByName.get(department) ?? { department, gross: 0, net: 0 };
    departmentTotal.gross += rowGross;
    departmentTotal.net += rowNet;
    departmentsByName.set(department, departmentTotal);
    const details =
      row.details && typeof row.details === 'object'
        ? (row.details as Record<string, unknown>)
        : {};
    const tax =
      details.tax && typeof details.tax === 'object'
        ? (details.tax as Record<string, unknown>)
        : {};
    taxTotal += Number(tax.amount ?? 0) / 100;
    const lineItems = Array.isArray(details.lineItems) ? details.lineItems : [];
    for (const item of lineItems) {
      if (!item || typeof item !== 'object') continue;
      const line = item as Record<string, unknown>;
      const lineType = typeof line.type === 'string' ? line.type : null;
      if (
        !lineType ||
        !['allowance', 'deduction', 'attendance-deduction'].includes(lineType) ||
        typeof line.name !== 'string'
      )
        continue;
      const componentType = lineType === 'attendance-deduction' ? 'deduction' : lineType;
      const key = `${componentType}:${line.name}`;
      const component = componentsByKey.get(key) ?? {
        name: line.name,
        type: componentType,
        amount: 0
      };
      component.amount += Number(line.amount ?? 0) / 100;
      componentsByKey.set(key, component);
    }
  }
  return {
    rows,
    gross,
    allowances,
    deductions,
    net,
    taxTotal,
    departmentTotals: [...departmentsByName.values()],
    componentTotals: [...componentsByKey.values()]
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
    const asOfDate = new Date().toISOString().slice(0, 10);
    const [employment, history] = await Promise.all([
      getEmploymentContext(data.employeeId, asOfDate),
      listEmployeePayrollProfileHistory(data.employeeId)
    ]);
    const assignment = history?.assignments
      ? resolveEffectiveRecord(data.employeeId, asOfDate, history.assignments)
      : null;
    const tax = history?.taxProfiles
      ? resolveEffectiveRecord(data.employeeId, asOfDate, history.taxProfiles)
      : null;
    const bank = history?.bankAccounts
      ? resolveEffectiveRecord(
          data.employeeId,
          asOfDate,
          history.bankAccounts.filter((account) => account.is_primary)
        )
      : null;
    return JSON.parse(
      JSON.stringify(
        sanitizePayrollProfileForActor(session, {
          employment,
          assignment,
          components: (history?.components ?? []).map(({ component, definition }) => ({
            component,
            definition,
            input: mapSalaryComponent(component, definition, component.salary_component_id)
          })),
          assignments: history?.assignments ?? [],
          tax,
          taxProfiles: history?.taxProfiles ?? [],
          benefits: history?.benefits ?? [],
          bank,
          bankAccounts: history?.bankAccounts ?? []
        })
      )
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
            const [existing] = await tx
              .select()
              .from(employeeSalaryAssignments)
              .where(
                and(
                  eq(employeeSalaryAssignments.id, data.values.id),
                  eq(employeeSalaryAssignments.employee_id, data.employeeId)
                )
              )
              .limit(1);
            if (!existing) throw new Error('Salary assignment was not found.');
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new salary assignment version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            await tx
              .update(employeeSalaryAssignments)
              .set({
                effective_to: closeEffectiveRecordAt(
                  existing.effective_from,
                  values.effective_from
                ),
                updated_at: new Date()
              })
              .where(eq(employeeSalaryAssignments.id, data.values.id));
            const [row] = await tx.insert(employeeSalaryAssignments).values(values).returning();
            if (!row) throw new Error('Failed to create salary assignment version.');
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
            mode: data.values.mode,
            percentage_base: data.values.percentageBase ?? null,
            attendance_metric: data.values.attendanceMetric ?? null,
            taxable: data.values.taxable,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null
          };
          if (data.values.id) {
            const [existing] = await tx
              .select({
                assignment_id: employeeSalaryComponents.assignment_id,
                salary_component_id: employeeSalaryComponents.salary_component_id,
                effective_from: employeeSalaryComponents.effective_from
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
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new salary component version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            await tx
              .update(employeeSalaryComponents)
              .set({
                effective_to: closeEffectiveRecordAt(
                  existing.effective_from,
                  values.effective_from
                ),
                updated_at: new Date()
              })
              .where(eq(employeeSalaryComponents.id, data.values.id));
            const [row] = await tx.insert(employeeSalaryComponents).values(values).returning();
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
            const [existing] = await tx
              .select()
              .from(employeeTaxProfiles)
              .where(
                and(
                  eq(employeeTaxProfiles.id, data.values.id),
                  eq(employeeTaxProfiles.employee_id, data.employeeId)
                )
              )
              .limit(1);
            if (!existing) throw new Error('Tax profile was not found.');
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new tax profile version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            await tx
              .update(employeeTaxProfiles)
              .set({
                effective_to: closeEffectiveRecordAt(
                  existing.effective_from,
                  values.effective_from
                ),
                updated_at: new Date()
              })
              .where(eq(employeeTaxProfiles.id, data.values.id));
            const [row] = await tx.insert(employeeTaxProfiles).values(values).returning();
            if (!row) throw new Error('Failed to create tax profile version.');
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
            const [existing] = await tx
              .select()
              .from(employeeBenefitEnrollments)
              .where(
                and(
                  eq(employeeBenefitEnrollments.id, data.values.id),
                  eq(employeeBenefitEnrollments.employee_id, data.employeeId)
                )
              )
              .limit(1);
            if (!existing) throw new Error('Benefit enrollment was not found.');
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new benefit enrollment version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            await tx
              .update(employeeBenefitEnrollments)
              .set({ effective_to: previousDate(values.effective_from), updated_at: new Date() })
              .where(eq(employeeBenefitEnrollments.id, data.values.id));
            const [row] = await tx.insert(employeeBenefitEnrollments).values(values).returning();
            if (!row) throw new Error('Failed to create benefit enrollment version.');
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
          const [existing] = await tx
            .select()
            .from(employeeBankAccounts)
            .where(
              and(
                eq(employeeBankAccounts.id, data.values.id),
                eq(employeeBankAccounts.employee_id, data.employeeId)
              )
            )
            .limit(1);
          if (!existing) throw new Error('Bank account was not found.');
          if (existing.effective_from >= values.effective_from)
            throw new DomainError(
              'Create a new bank account version with a later effective date.',
              'HISTORICAL_RECORD_IMMUTABLE'
            );
          const nextValues = {
            ...values,
            account_number: values.account_number || existing.account_number
          };
          await tx
            .update(employeeBankAccounts)
            .set({
              effective_to: closeEffectiveRecordAt(existing.effective_from, values.effective_from),
              updated_at: new Date()
            })
            .where(eq(employeeBankAccounts.id, data.values.id));
          const [row] = await tx.insert(employeeBankAccounts).values(nextValues).returning();
          if (!row) throw new Error('Failed to create bank account version.');
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
            payment_date: data.paymentDate,
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
  const assignments = (await tx
    .select()
    .from(scheduleAssignments)
    .where(
      and(
        eq(scheduleAssignments.user_id, employeeId),
        lte(scheduleAssignments.effective_from, periodEnd),
        sql`${scheduleAssignments.effective_to} is null or ${scheduleAssignments.effective_to} >= ${periodStart}`
      )
    )) as Array<typeof scheduleAssignments.$inferSelect>;
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
  const overrideByDate = new Map(overrides.map((row) => [row.date, row.shift_id]));
  const daysOffSet = new Set(daysOff.map((row) => row.date));
  let scheduledDays = 0;
  for (
    let cursor = dateOnly(periodStart);
    cursor <= dateOnly(periodEnd);
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    if (daysOffSet.has(date)) continue;
    const assignment = assignments.find(
      (row) => row.effective_from <= date && (!row.effective_to || row.effective_to >= date)
    );
    const shiftId = overrideByDate.get(date) ?? assignment?.shift_id;
    const rule = rules.find(
      (row) => row.shift_id === shiftId && row.day_of_week === cursor.getUTCDay()
    );
    if (rule?.is_working_day) scheduledDays += 1;
  }
  return scheduledDays;
}

export async function buildPayrollRecord(
  employeeId: string,
  period: { id: number; period_start: string; period_end: string },
  tx: PayrollTransaction
) {
  const assignments = (await tx
    .select()
    .from(employeeSalaryAssignments)
    .where(
      and(
        eq(employeeSalaryAssignments.employee_id, employeeId),
        lte(employeeSalaryAssignments.effective_from, period.period_end),
        sql`${employeeSalaryAssignments.effective_to} is null or ${employeeSalaryAssignments.effective_to} >= ${period.period_start}`
      )
    )) as Array<typeof employeeSalaryAssignments.$inferSelect>;
  const componentRows = (await getEffectiveSalaryComponents(
    employeeId,
    period.period_start,
    period.period_end,
    tx
  )) as Array<{
    component: typeof employeeSalaryComponents.$inferSelect;
    definition: typeof salaryComponents.$inferSelect | null;
  }>;
  const taxRows = (await tx
    .select()
    .from(employeeTaxProfiles)
    .where(
      and(
        eq(employeeTaxProfiles.employee_id, employeeId),
        lte(employeeTaxProfiles.effective_from, period.period_end),
        sql`${employeeTaxProfiles.effective_to} is null or ${employeeTaxProfiles.effective_to} >= ${period.period_start}`
      )
    )) as Array<typeof employeeTaxProfiles.$inferSelect>;
  const attendanceRows = (await tx
    .select()
    .from(employeeShifts)
    .where(
      and(
        eq(employeeShifts.user_id, employeeId),
        gte(employeeShifts.date, period.period_start),
        lte(employeeShifts.date, period.period_end)
      )
    )) as Array<typeof employeeShifts.$inferSelect>;
  const leaveRows = await tx
    .select({
      start_date: leaves.start_date,
      end_date: leaves.end_date,
      total_days: leaves.total_days,
      status: leaves.status,
      is_paid: sql<boolean>`coalesce(${leaveTypeConfigs.is_paid}, true)`
    })
    .from(leaves)
    .leftJoin(leaveTypeConfigs, eq(leaves.leave_type, leaveTypeConfigs.leave_type))
    .where(
      and(
        eq(leaves.user_id, employeeId),
        lte(leaves.start_date, period.period_end),
        gte(leaves.end_date, period.period_start)
      )
    );
  const benefits = (await tx
    .select()
    .from(employeeBenefitEnrollments)
    .where(
      and(
        eq(employeeBenefitEnrollments.employee_id, employeeId),
        eq(employeeBenefitEnrollments.status, 'active'),
        lte(employeeBenefitEnrollments.effective_from, period.period_end),
        sql`${employeeBenefitEnrollments.effective_to} is null or ${employeeBenefitEnrollments.effective_to} >= ${period.period_start}`
      )
    )) as Array<typeof employeeBenefitEnrollments.$inferSelect>;
  const bankAccounts = (await tx
    .select()
    .from(employeeBankAccounts)
    .where(
      and(
        eq(employeeBankAccounts.employee_id, employeeId),
        eq(employeeBankAccounts.is_primary, true),
        lte(employeeBankAccounts.effective_from, period.period_end),
        sql`${employeeBankAccounts.effective_to} is null or ${employeeBankAccounts.effective_to} >= ${period.period_start}`
      )
    )) as Array<typeof employeeBankAccounts.$inferSelect>;
  const employmentEvents = (await tx
    .select()
    .from(employeeEmploymentEvents)
    .where(
      and(
        eq(employeeEmploymentEvents.employee_id, employeeId),
        lte(employeeEmploymentEvents.effective_date, period.period_end)
      )
    )) as Array<typeof employeeEmploymentEvents.$inferSelect>;
  const boundaries = payrollPeriodBoundaries(
    period.period_start,
    period.period_end,
    [...assignments, ...taxRows, ...componentRows.map(({ component }) => component)].map(
      (row) => row.effective_from
    )
  );
  const segmentResults = [];
  const segmentInputs: PayrollCalculationInput[] = [];
  for (let index = 0; index < boundaries.length; index += 1) {
    const segmentStart = boundaries[index]!;
    const segmentEnd = boundaries[index + 1]
      ? previousDate(boundaries[index + 1]!)
      : period.period_end;
    if (segmentStart > segmentEnd) continue;
    const assignment = resolveEffectiveRecord(employeeId, segmentStart, assignments);
    const tax = resolveEffectiveRecord(employeeId, segmentStart, taxRows);
    if (!assignment || !tax)
      throw new DomainError(
        'Required payroll data is missing for this period.',
        'MISSING_PAYROLL_DATA'
      );
    const setting = tax.tax_setting_id
      ? ((
          await tx
            .select({ rates: taxSettings.rates })
            .from(taxSettings)
            .where(eq(taxSettings.id, tax.tax_setting_id))
            .limit(1)
        )[0] ?? null)
      : null;
    const components = [];
    const rowsByComponent = new Map<number, typeof componentRows>();
    for (const row of componentRows) {
      if (row.component.assignment_id !== assignment.id) continue;
      const rows = rowsByComponent.get(row.component.salary_component_id) ?? [];
      rows.push(row);
      rowsByComponent.set(row.component.salary_component_id, rows);
    }
    for (const rows of rowsByComponent.values()) {
      const selected = resolveEffectiveRecord(
        employeeId,
        segmentStart,
        rows.map((row) => row.component)
      );
      const row = rows.find((candidate) => candidate.component.id === selected?.id);
      if (row)
        components.push(
          mapSalaryComponent(row.component, row.definition, row.component.salary_component_id)
        );
    }
    const segmentAttendanceRows = attendanceRows.filter(
      (row) => row.date >= segmentStart && row.date <= segmentEnd
    );
    const scheduledDays = await getScheduledDays(tx, employeeId, segmentStart, segmentEnd);
    const attendance = buildAttendanceTotals(segmentAttendanceRows, leaveRows, {
      periodStart: segmentStart,
      periodEnd: segmentEnd,
      scheduledDays,
      payableDays: 0,
      absentDays: 0
    });
    const input: PayrollCalculationInput = {
      salary: { type: assignment.salary_type, amount: parseDbDecimalToMoney(assignment.amount) },
      attendance,
      attendancePolicy: emptyPolicy,
      components,
      manualAdjustments: [],
      tax: mapTaxProfile(tax, setting)
    };
    segmentInputs.push(input);
    segmentResults.push({
      result: calculatePayroll(input),
      assignmentId: assignment.id,
      taxId: tax.id,
      start: segmentStart,
      end: segmentEnd,
      benefits: benefits.filter(
        (row) =>
          row.effective_from <= segmentStart &&
          (!row.effective_to || row.effective_to >= segmentStart)
      ),
      bank:
        bankAccounts.find(
          (row) =>
            row.effective_from <= segmentStart &&
            (!row.effective_to || row.effective_to >= segmentStart)
        ) ?? null
    });
  }
  const totals = segmentResults.reduce(
    (sum, segment) => ({
      baseSalary: sum.baseSalary + segment.result.baseSalary,
      allowanceTotal: sum.allowanceTotal + segment.result.allowanceTotal,
      deductionTotal: sum.deductionTotal + segment.result.deductionTotal,
      grossSalary: sum.grossSalary + segment.result.grossSalary,
      netSalary: sum.netSalary + segment.result.netSalary,
      tax: sum.tax + segment.result.tax.amount,
      lineItems: [...sum.lineItems, ...segment.result.lineItems]
    }),
    {
      baseSalary: 0,
      allowanceTotal: 0,
      deductionTotal: 0,
      grossSalary: 0,
      netSalary: 0,
      tax: 0,
      lineItems: [] as PayrollCalculationResult['lineItems']
    }
  );
  return {
    payroll_period_id: period.id,
    employee_id: employeeId,
    gross_salary: (totals.grossSalary / 100).toFixed(2),
    total_allowances: (totals.allowanceTotal / 100).toFixed(2),
    total_deductions: (totals.deductionTotal / 100).toFixed(2),
    net_salary: (totals.netSalary / 100).toFixed(2),
    details: {
      input: segmentInputs,
      baseSalary: totals.baseSalary,
      allowanceTotal: totals.allowanceTotal,
      deductionTotal: totals.deductionTotal,
      grossSalary: totals.grossSalary,
      netSalary: totals.netSalary,
      lineItems: totals.lineItems,
      resolvedSegments: segmentResults,
      employmentEvents
    }
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

export const adjustPayrollRecordFn = createServerFn({ method: 'POST' })
  .validator(payrollRecordAdjustmentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.record.adjust', entityType: 'payroll_record', entityId: data.id },
      async (tx) => {
        const [record] = await tx
          .select()
          .from(payrollRecords)
          .where(eq(payrollRecords.id, data.id))
          .limit(1);
        if (!record) throw new Error('Payroll record was not found.');
        const period = await lockPayrollPeriod(tx, record.payroll_period_id);
        if (!period) throw new Error('Payroll period was not found.');
        assertPayrollAdjustmentAllowed(period.status);
        const details =
          record.details && typeof record.details === 'object'
            ? (record.details as Record<string, unknown>)
            : null;
        const input = details?.input;
        if (!input || typeof input !== 'object')
          throw new Error('Payroll calculation input is unavailable.');
        const result = calculatePayroll({
          ...(input as PayrollCalculationInput),
          manualAdjustments: data.adjustments.map((adjustment) => ({
            ...adjustment,
            amount: parseDbDecimalToMoney(adjustment.amount)
          }))
        });
        const [updated] = await tx
          .update(payrollRecords)
          .set({
            gross_salary: (result.grossSalary / 100).toFixed(2),
            total_allowances: (result.allowanceTotal / 100).toFixed(2),
            total_deductions: (result.deductionTotal / 100).toFixed(2),
            net_salary: (result.netSalary / 100).toFixed(2),
            details: result.snapshot,
            updated_at: new Date()
          })
          .where(eq(payrollRecords.id, data.id))
          .returning();
        if (!updated) throw new Error('Payroll record changed during adjustment.');
        return JSON.parse(JSON.stringify(updated));
      }
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
    const result = await listMyPayslips(session.user.id, {
      payroll_period_id: data.payrollPeriodId,
      page: data.page,
      limit: data.limit
    });
    const rows = await Promise.all(
      result.rows.map(async (row) => {
        const bank = await getPrimaryBankAccount(session.user.id, row.period_end);
        const accountNumber = bank?.account_number ?? '';
        return {
          ...row,
          bank_name: bank?.bank_name ?? null,
          bank_account_number: accountNumber ? `******${accountNumber.slice(-4)}` : null
        };
      })
    );
    return JSON.parse(JSON.stringify({ ...result, company: getCompanyProfile(), rows }));
  });
export const getPayrollReportFn = createServerFn({ method: 'GET' })
  .validator(reportFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('payroll', 'reports');
    const rows = await listPayrollReportRows({
      payroll_period_id: data.payrollPeriodId,
      employee_id: data.employeeId,
      department_id: data.departmentId,
      status: data.status
    });
    const aggregate = aggregatePayrollRows(JSON.parse(JSON.stringify(rows ?? [])));
    if (data.format === 'csv')
      return serializePayrollReport({ rows: aggregate.rows }, 'csv') as unknown as {
        format: 'csv';
        content: string;
        encoding: 'identity';
        mime: 'text/csv';
        ext: 'csv';
      };
    if (data.format === 'xlsx') {
      const { writeXlsxBuffer } = await import('@/features/attendance/api/export-adapter');
      const buffer = writeXlsxBuffer(
        aggregate.rows as unknown as Array<Record<string, unknown>>,
        'Payroll'
      );
      return {
        format: 'xlsx' as const,
        content: buffer.toString('base64'),
        encoding: 'base64' as const,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ext: 'xlsx'
      };
    }
    return JSON.parse(JSON.stringify(aggregate));
  });

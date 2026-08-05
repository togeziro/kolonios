import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, gte, lte, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { db } from '@/lib/db';
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
  companyPayrollSettings,
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeBpjsEnrollments,
  employeeBpjsFamilyMembers,
  employeeEmploymentEvents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  employeeTaxRecords,
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
  getCompanyPayrollSettings,
  listEmployeeBpjsEnrollments,
  listEmployeeBpjsFamilyMembers,
  upsertEmployeeBpjsEnrollment,
  getAttendanceOverride,
  upsertAttendanceOverride,
  mapPtkpStatusToAmount,
  type PayrollTransaction
} from '@/lib/db/payroll';
import { calculatePayroll, JKK_RATES, parseDbDecimalToMoney } from '../utils/calculator';
import type {
  AttendancePolicy,
  BpjsInput,
  BpjsProgram,
  BpjsRates,
  ManualAdjustment,
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollProfileActor,
  Pph21Method,
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
  myPayslipFiltersSchema,
  companyPayrollSettingsSchema,
  bpjsEnrollmentSchema,
  bpjsFamilyMemberSchema,
  bpjsFamilyMemberIdSchema,
  attendanceOverrideSchema,
  taxRecordOverrideSchema
} from './validation';

const emptyPolicy: AttendancePolicy = {
  absence: { enabled: true },
  late: { mode: 'none' },
  unpaidLeave: { enabled: true },
  monthlyAttendanceMode: 'prorate',
  permitHour: { enabled: false },
  shortfall: { enabled: false }
};

function recalculateSegmentsWithAdjustments(
  segmentInputs: PayrollCalculationInput[],
  adjustments: ManualAdjustment[],
  resolvedSegments?: Array<{
    assignmentId: number;
    taxId: number;
    start: string;
    end: string;
    benefits: unknown;
    bank: unknown;
    employmentEvent: unknown;
  }>,
  employmentEvents?: unknown[]
) {
  const results = segmentInputs.map((segmentInput) =>
    calculatePayroll({
      ...segmentInput,
      manualAdjustments: adjustments
    })
  );
  const totals = results.reduce(
    (sum, segment) => ({
      baseSalary: sum.baseSalary + segment.baseSalary,
      allowanceTotal: sum.allowanceTotal + segment.allowanceTotal,
      deductionTotal: sum.deductionTotal + segment.deductionTotal,
      grossSalary: sum.grossSalary + segment.grossSalary,
      netSalary: sum.netSalary + segment.netSalary,
      tax: sum.tax + segment.tax.amount,
      lineItems: [...sum.lineItems, ...segment.lineItems]
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
    ...totals,
    snapshot: {
      input: segmentInputs,
      baseSalary: totals.baseSalary,
      allowanceTotal: totals.allowanceTotal,
      deductionTotal: totals.deductionTotal,
      grossSalary: totals.grossSalary,
      netSalary: totals.netSalary,
      lineItems: totals.lineItems,
      resolvedSegments: results.map((result, index) => {
        const existing = resolvedSegments?.[index];
        return {
          result,
          assignmentId: existing?.assignmentId ?? 0,
          taxId: existing?.taxId ?? 0,
          start: existing?.start ?? '',
          end: existing?.end ?? '',
          benefits: existing?.benefits ?? null,
          bank: existing?.bank ?? null,
          employmentEvent: existing?.employmentEvent ?? null
        };
      }),
      employmentEvents: employmentEvents ?? []
    }
  };
}

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

function maskAccountNumber(value: unknown): string | null {
  return typeof value === 'string' && value.length > 4 ? `******${value.slice(-4)}` : null;
}

export function sanitizePayrollProfileForActor<T extends Record<string, unknown>>(
  actor: PayrollProfileActor,
  profile: T
): T {
  if (!['employee', 'technician', 'user'].includes(actor.user.role ?? '')) return profile;
  const json = JSON.parse(JSON.stringify(profile)) as T;
  const record = json as Record<string, unknown>;
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
      row.account_number = maskAccountNumber(row.account_number);
    }
  }
  if (record.bank && typeof record.bank === 'object') {
    const bank = record.bank as Record<string, unknown>;
    bank.account_number = maskAccountNumber(bank.account_number);
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
    throw new DomainError(`Invalid tax rate: ${name}`, 'INVALID_TAX_RATE');
  const rate = Number(text);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100)
    throw new DomainError(`Invalid tax rate: ${name}`, 'INVALID_TAX_RATE');
  return rate;
}

function parseTaxMoney(value: unknown, name: string) {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new DomainError(`Invalid tax amount: ${name}`, 'INVALID_TAX_AMOUNT');
  try {
    return parseDbDecimalToMoney(typeof value === 'number' ? value.toFixed(2) : value);
  } catch {
    throw new DomainError(`Invalid tax amount: ${name}`, 'INVALID_TAX_AMOUNT');
  }
}

export function mapTaxProfile(
  profile: Awaited<ReturnType<typeof getEffectiveTaxProfile>>,
  setting: { rates: unknown } | null
): TaxProfile {
  const rates = setting?.rates;
  if (rates == null || typeof rates !== 'object' || Array.isArray(rates)) {
    if (!setting) return { method: 'none', ptkp: 0, settings: {} };
    throw new DomainError('Invalid tax settings JSON', 'INVALID_TAX_SETTINGS');
  }
  const raw = rates as Record<string, unknown>;
  const method = raw.method;
  if (method !== 'none' && method !== 'progressive' && method !== 'ter')
    throw new DomainError('Invalid tax method', 'INVALID_TAX_METHOD');
  const progressive = raw.progressive;
  const parsedProgressive =
    progressive == null
      ? undefined
      : (() => {
          if (!Array.isArray(progressive))
            throw new DomainError('Invalid progressive tax brackets', 'INVALID_TAX_BRACKETS');
          return progressive.map((bracket, index) => {
            if (!bracket || typeof bracket !== 'object' || Array.isArray(bracket))
              throw new DomainError(`Invalid progressive bracket: ${index}`, 'INVALID_TAX_BRACKET');
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
            throw new DomainError('Invalid TER tax categories', 'INVALID_TER_CATEGORIES');
          return Object.fromEntries(
            Object.entries(ter).map(([category, brackets]) => {
              if (!category.trim() || !Array.isArray(brackets))
                throw new DomainError(`Invalid TER category: ${category}`, 'INVALID_TER_CATEGORY');
              return [
                category,
                brackets.map((bracket, index) => {
                  if (!bracket || typeof bracket !== 'object' || Array.isArray(bracket))
                    throw new DomainError(
                      `Invalid TER bracket: ${category}[${index}]`,
                      'INVALID_TER_BRACKET'
                    );
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
    unpaidLeaveDays,
    permitHours: 0,
    shortfallHours: 0
  };
}

function escapeCsvValue(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializePayrollReport(
  result: { rows: Array<Record<string, unknown>> },
  format: 'json' | 'csv'
) {
  if (format === 'json') return result;
  const headers = [...new Set(result.rows.flatMap((row) => Object.keys(row)))];
  return {
    ...result,
    format,
    mime: 'text/csv',
    encoding: 'identity' as const,
    ext: 'csv',
    content: [
      headers.join(','),
      ...result.rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','))
    ].join('\n')
  };
}

export function assertPayrollAdjustmentAllowed(status: string) {
  if (status !== 'processing') {
    throw new DomainError(
      'Manual adjustments are only allowed before payroll approval.',
      'ADJUSTMENT_NOT_ALLOWED'
    );
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
        if (!row)
          throw new DomainError(
            'Failed to create salary component.',
            'PAYROLL_COMPONENT_CREATE_FAILED'
          );
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
        if (!row)
          throw new DomainError('Salary component was not found.', 'PAYROLL_COMPONENT_NOT_FOUND');
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
    const [employment, history, taxRecords, paymentHistory] = await Promise.all([
      getEmploymentContext(data.employeeId, asOfDate),
      listEmployeePayrollProfileHistory(data.employeeId),
      db
        .select()
        .from(employeeTaxRecords)
        .where(eq(employeeTaxRecords.employee_id, data.employeeId))
        .orderBy(desc(employeeTaxRecords.tax_period)),
      db
        .select({
          id: payrollRecords.id,
          period_name: payrollPeriods.name,
          period_start: payrollPeriods.period_start,
          period_end: payrollPeriods.period_end,
          payment_date: payrollPeriods.payment_date,
          net_salary: payrollRecords.net_salary,
          period_status: payrollPeriods.status
        })
        .from(payrollRecords)
        .innerJoin(payrollPeriods, eq(payrollRecords.payroll_period_id, payrollPeriods.id))
        .where(
          and(eq(payrollRecords.employee_id, data.employeeId), ne(payrollPeriods.status, 'draft'))
        )
        .orderBy(desc(payrollPeriods.period_start))
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
          bankAccounts: history?.bankAccounts ?? [],
          taxRecords,
          paymentHistory
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
            if (!existing)
              throw new DomainError(
                'Salary assignment was not found.',
                'PAYROLL_ASSIGNMENT_NOT_FOUND'
              );
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new salary assignment version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            const overlapping = await tx
              .select()
              .from(employeeSalaryAssignments)
              .where(
                and(
                  eq(employeeSalaryAssignments.employee_id, data.employeeId),
                  eq(employeeSalaryAssignments.id, data.values.id),
                  lte(employeeSalaryAssignments.effective_from, values.effective_from),
                  or(
                    sql`${employeeSalaryAssignments.effective_to} is null`,
                    gte(employeeSalaryAssignments.effective_to, values.effective_from)
                  )
                )
              )
              .limit(1);
            if (overlapping.length > 1)
              throw new DomainError(
                'Overlapping salary assignment versions exist.',
                'OVERLAPPING_EFFECTIVE_RECORDS'
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
            if (!row)
              throw new DomainError(
                'Failed to create salary assignment version.',
                'PAYROLL_ASSIGNMENT_VERSION_FAILED'
              );
            return row;
          }
          const overlappingAssignment = await tx
            .select()
            .from(employeeSalaryAssignments)
            .where(
              and(
                eq(employeeSalaryAssignments.employee_id, data.employeeId),
                lte(employeeSalaryAssignments.effective_from, values.effective_from),
                or(
                  sql`${employeeSalaryAssignments.effective_to} is null`,
                  gte(employeeSalaryAssignments.effective_to, values.effective_from)
                )
              )
            )
            .limit(1);
          if (overlappingAssignment.length > 0) {
            await tx
              .update(employeeSalaryAssignments)
              .set({
                effective_to: previousDate(values.effective_from),
                updated_at: new Date()
              })
              .where(eq(employeeSalaryAssignments.id, overlappingAssignment[0].id));
          }
          const [row] = await tx.insert(employeeSalaryAssignments).values(values).returning();
          if (!row)
            throw new DomainError(
              'Failed to create salary assignment.',
              'PAYROLL_ASSIGNMENT_CREATE_FAILED'
            );
          return row;
        }
        if (data.kind === 'component') {
          const [assignment] = await tx
            .select({ employee_id: employeeSalaryAssignments.employee_id })
            .from(employeeSalaryAssignments)
            .where(eq(employeeSalaryAssignments.id, data.values.assignmentId))
            .limit(1);
          if (!assignment)
            throw new DomainError(
              'Salary assignment was not found.',
              'PAYROLL_ASSIGNMENT_NOT_FOUND'
            );
          assertProfileReferenceScope(session, data.employeeId, assignment.employee_id);
          const [definition] = await tx
            .select({ id: salaryComponents.id })
            .from(salaryComponents)
            .where(eq(salaryComponents.id, data.values.salaryComponentId))
            .limit(1);
          if (!definition)
            throw new DomainError('Salary component was not found.', 'PAYROLL_COMPONENT_NOT_FOUND');
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
            if (!existing)
              throw new DomainError(
                'Employee salary component was not found.',
                'PAYROLL_COMPONENT_NOT_FOUND'
              );
            if (
              existing.assignment_id !== data.values.assignmentId ||
              existing.salary_component_id !== data.values.salaryComponentId
            ) {
              throw new DomainError('Salary component identity is immutable.', 'IMMUTABLE_FIELD');
            }
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new salary component version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            const overlapping = await tx
              .select()
              .from(employeeSalaryComponents)
              .where(
                and(
                  eq(employeeSalaryComponents.assignment_id, data.values.assignmentId),
                  eq(employeeSalaryComponents.salary_component_id, data.values.salaryComponentId),
                  lte(employeeSalaryComponents.effective_from, values.effective_from),
                  or(
                    sql`${employeeSalaryComponents.effective_to} is null`,
                    gte(employeeSalaryComponents.effective_to, values.effective_from)
                  )
                )
              )
              .limit(1);
            if (overlapping.length > 1)
              throw new DomainError(
                'Overlapping salary component versions exist.',
                'OVERLAPPING_EFFECTIVE_RECORDS'
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
            if (!row)
              throw new DomainError(
                'Employee salary component was not found.',
                'PAYROLL_COMPONENT_VERSION_FAILED'
              );
            return row;
          }
          const overlappingComponent = await tx
            .select()
            .from(employeeSalaryComponents)
            .where(
              and(
                eq(employeeSalaryComponents.assignment_id, data.values.assignmentId),
                eq(employeeSalaryComponents.salary_component_id, data.values.salaryComponentId),
                lte(employeeSalaryComponents.effective_from, values.effective_from),
                or(
                  sql`${employeeSalaryComponents.effective_to} is null`,
                  gte(employeeSalaryComponents.effective_to, values.effective_from)
                )
              )
            )
            .limit(1);
          if (overlappingComponent.length > 0) {
            await tx
              .update(employeeSalaryComponents)
              .set({
                effective_to: previousDate(values.effective_from),
                updated_at: new Date()
              })
              .where(eq(employeeSalaryComponents.id, overlappingComponent[0].id));
          }
          const [row] = await tx.insert(employeeSalaryComponents).values(values).returning();
          if (!row)
            throw new DomainError(
              'Failed to create employee salary component.',
              'PAYROLL_COMPONENT_CREATE_FAILED'
            );
          return row;
        }
        if (data.kind === 'tax') {
          const values = {
            employee_id: data.employeeId,
            tax_setting_id: data.values.taxSettingId ?? null,
            tax_identifier: data.values.taxIdentifier ?? null,
            filing_status: data.values.filingStatus ?? null,
            employment_status: data.values.employmentStatus ?? undefined,
            ptkp_status: data.values.ptkpStatus ?? undefined,
            residency: data.values.residency ?? undefined,
            tax_facility: data.values.taxFacility ?? undefined,
            tax_object_code: data.values.taxObjectCode ?? undefined,
            pph21_method: data.values.pph21Method ?? null,
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
            if (!existing)
              throw new DomainError('Tax profile was not found.', 'TAX_PROFILE_NOT_FOUND');
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new tax profile version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            const overlapping = await tx
              .select()
              .from(employeeTaxProfiles)
              .where(
                and(
                  eq(employeeTaxProfiles.employee_id, data.employeeId),
                  lte(employeeTaxProfiles.effective_from, values.effective_from),
                  or(
                    sql`${employeeTaxProfiles.effective_to} is null`,
                    gte(employeeTaxProfiles.effective_to, values.effective_from)
                  )
                )
              )
              .limit(1);
            if (overlapping.length > 1)
              throw new DomainError(
                'Overlapping tax profile versions exist.',
                'OVERLAPPING_EFFECTIVE_RECORDS'
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
            if (!row)
              throw new DomainError(
                'Failed to create tax profile version.',
                'TAX_PROFILE_VERSION_FAILED'
              );
            return row;
          }
          const overlappingTax = await tx
            .select()
            .from(employeeTaxProfiles)
            .where(
              and(
                eq(employeeTaxProfiles.employee_id, data.employeeId),
                lte(employeeTaxProfiles.effective_from, values.effective_from),
                or(
                  sql`${employeeTaxProfiles.effective_to} is null`,
                  gte(employeeTaxProfiles.effective_to, values.effective_from)
                )
              )
            )
            .limit(1);
          if (overlappingTax.length > 0) {
            await tx
              .update(employeeTaxProfiles)
              .set({
                effective_to: previousDate(values.effective_from),
                updated_at: new Date()
              })
              .where(eq(employeeTaxProfiles.id, overlappingTax[0].id));
          }
          const [row] = await tx.insert(employeeTaxProfiles).values(values).returning();
          if (!row)
            throw new DomainError('Failed to create tax profile.', 'TAX_PROFILE_CREATE_FAILED');
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
            if (!existing)
              throw new DomainError('Benefit enrollment was not found.', 'BENEFIT_NOT_FOUND');
            if (existing.effective_from >= values.effective_from)
              throw new DomainError(
                'Create a new benefit enrollment version with a later effective date.',
                'HISTORICAL_RECORD_IMMUTABLE'
              );
            const overlapping = await tx
              .select()
              .from(employeeBenefitEnrollments)
              .where(
                and(
                  eq(employeeBenefitEnrollments.employee_id, data.employeeId),
                  lte(employeeBenefitEnrollments.effective_from, values.effective_from),
                  or(
                    sql`${employeeBenefitEnrollments.effective_to} is null`,
                    gte(employeeBenefitEnrollments.effective_to, values.effective_from)
                  )
                )
              )
              .limit(1);
            if (overlapping.length > 1)
              throw new DomainError(
                'Overlapping benefit enrollment versions exist.',
                'OVERLAPPING_EFFECTIVE_RECORDS'
              );
            await tx
              .update(employeeBenefitEnrollments)
              .set({ effective_to: previousDate(values.effective_from), updated_at: new Date() })
              .where(eq(employeeBenefitEnrollments.id, data.values.id));
            const [row] = await tx.insert(employeeBenefitEnrollments).values(values).returning();
            if (!row)
              throw new DomainError(
                'Failed to create benefit enrollment version.',
                'BENEFIT_VERSION_FAILED'
              );
            return row;
          }
          const overlappingBenefit = await tx
            .select()
            .from(employeeBenefitEnrollments)
            .where(
              and(
                eq(employeeBenefitEnrollments.employee_id, data.employeeId),
                lte(employeeBenefitEnrollments.effective_from, values.effective_from),
                or(
                  sql`${employeeBenefitEnrollments.effective_to} is null`,
                  gte(employeeBenefitEnrollments.effective_to, values.effective_from)
                )
              )
            )
            .limit(1);
          if (overlappingBenefit.length > 0) {
            await tx
              .update(employeeBenefitEnrollments)
              .set({
                effective_to: previousDate(values.effective_from),
                updated_at: new Date()
              })
              .where(eq(employeeBenefitEnrollments.id, overlappingBenefit[0].id));
          }
          const [row] = await tx.insert(employeeBenefitEnrollments).values(values).returning();
          if (!row)
            throw new DomainError('Failed to create benefit enrollment.', 'BENEFIT_CREATE_FAILED');
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
          if (!existing)
            throw new DomainError('Bank account was not found.', 'BANK_ACCOUNT_NOT_FOUND');
          if (existing.effective_from >= values.effective_from)
            throw new DomainError(
              'Create a new bank account version with a later effective date.',
              'HISTORICAL_RECORD_IMMUTABLE'
            );
          if (values.is_primary) {
            const activePrimary = await tx
              .select()
              .from(employeeBankAccounts)
              .where(
                and(
                  eq(employeeBankAccounts.employee_id, data.employeeId),
                  eq(employeeBankAccounts.is_primary, true),
                  ne(employeeBankAccounts.id, data.values.id),
                  or(
                    sql`${employeeBankAccounts.effective_to} is null`,
                    gte(employeeBankAccounts.effective_to, values.effective_from)
                  )
                )
              )
              .limit(1);
            if (activePrimary.length > 0)
              throw new DomainError(
                'A primary bank account already exists for this employee.',
                'DUPLICATE_PRIMARY_BANK_ACCOUNT'
              );
          }
          const overlapping = await tx
            .select()
            .from(employeeBankAccounts)
            .where(
              and(
                eq(employeeBankAccounts.employee_id, data.employeeId),
                lte(employeeBankAccounts.effective_from, values.effective_from),
                or(
                  sql`${employeeBankAccounts.effective_to} is null`,
                  gte(employeeBankAccounts.effective_to, values.effective_from)
                )
              )
            )
            .limit(1);
          if (overlapping.length > 0)
            throw new DomainError(
              'Overlapping bank account versions exist.',
              'OVERLAPPING_EFFECTIVE_RECORDS'
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
          if (!row)
            throw new DomainError(
              'Failed to create bank account version.',
              'BANK_ACCOUNT_VERSION_FAILED'
            );
          return row;
        }
        if (values.is_primary) {
          const activePrimary = await tx
            .select()
            .from(employeeBankAccounts)
            .where(
              and(
                eq(employeeBankAccounts.employee_id, data.employeeId),
                eq(employeeBankAccounts.is_primary, true),
                or(
                  sql`${employeeBankAccounts.effective_to} is null`,
                  gte(employeeBankAccounts.effective_to, values.effective_from)
                )
              )
            )
            .limit(1);
          if (activePrimary.length > 0)
            throw new DomainError(
              'A primary bank account already exists for this employee.',
              'DUPLICATE_PRIMARY_BANK_ACCOUNT'
            );
        }
        const overlappingBank = await tx
          .select()
          .from(employeeBankAccounts)
          .where(
            and(
              eq(employeeBankAccounts.employee_id, data.employeeId),
              lte(employeeBankAccounts.effective_from, values.effective_from),
              or(
                sql`${employeeBankAccounts.effective_to} is null`,
                gte(employeeBankAccounts.effective_to, values.effective_from)
              )
            )
          )
          .limit(1);
        if (overlappingBank.length > 0) {
          await tx
            .update(employeeBankAccounts)
            .set({
              effective_to: previousDate(values.effective_from),
              updated_at: new Date()
            })
            .where(eq(employeeBankAccounts.id, overlappingBank[0].id));
        }
        const [row] = await tx.insert(employeeBankAccounts).values(values).returning();
        if (!row)
          throw new DomainError('Failed to create bank account.', 'BANK_ACCOUNT_CREATE_FAILED');
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
        if (!row)
          throw new DomainError('Failed to create payroll period.', 'PAYROLL_PERIOD_CREATE_FAILED');
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
    [
      ...assignments,
      ...taxRows,
      ...componentRows.map(({ component }) => component),
      ...benefits,
      ...bankAccounts,
      ...employmentEvents
    ].map(
      (row) =>
        (row as { effective_from?: string; effective_date?: string }).effective_from ??
        (row as { effective_date?: string }).effective_date ??
        ''
    )
  );
  const settings = (await getCompanyPayrollSettings()) ?? null;
  const bpjsRows = (await tx
    .select()
    .from(employeeBpjsEnrollments)
    .where(
      and(
        eq(employeeBpjsEnrollments.employee_id, employeeId),
        eq(employeeBpjsEnrollments.is_active, true),
        lte(employeeBpjsEnrollments.effective_from, period.period_end),
        sql`${employeeBpjsEnrollments.effective_to} is null or ${employeeBpjsEnrollments.effective_to} >= ${period.period_start}`
      )
    )) as Array<typeof employeeBpjsEnrollments.$inferSelect>;
  const override = await getAttendanceOverride(period.id, employeeId);
  const enabled: Record<BpjsProgram, boolean> = {
    jkk: settings?.jkk_enabled ?? false,
    jkm: settings?.jkm_enabled ?? false,
    jht: settings?.jht_enabled ?? false,
    jp: settings?.jp_enabled ?? false,
    kesehatan: settings?.bpjs_kesehatan_enabled ?? false
  };
  const rates: BpjsRates = {
    jkk: JKK_RATES,
    jkmCompany: Number(settings?.jkm_company_rate ?? 0.3),
    jhtCompany: Number(settings?.jht_company_rate ?? 3.7),
    jhtEmployee: Number(settings?.jht_employee_rate ?? 2),
    jpCompany: Number(settings?.jp_company_rate ?? 2),
    jpEmployee: Number(settings?.jp_employee_rate ?? 1),
    kesehatanCompany: Number(settings?.kesehatan_company_rate ?? 4),
    kesehatanEmployee: Number(settings?.kesehatan_employee_rate ?? 1)
  };
  const bpjsInput: BpjsInput = {
    enrollments: bpjsRows.map((row) => ({
      program: row.program,
      registeredWage: parseDbDecimalToMoney(row.registered_wage),
      ...(row.jkk_category_override
        ? { jkkCategoryOverride: row.jkk_category_override }
        : row.program === 'jkk'
          ? { jkkCategoryOverride: settings?.jkk_risk_category ?? 'low' }
          : {})
    })),
    rates,
    enabled
  };
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
    const permitAmount =
      settings?.potongan_izin_jam_default != null
        ? parseDbDecimalToMoney(settings.potongan_izin_jam_default)
        : undefined;
    const shortfallAmount =
      settings?.potongan_shortfall_default != null
        ? parseDbDecimalToMoney(settings.potongan_shortfall_default)
        : undefined;
    const attendancePolicy: AttendancePolicy = {
      ...emptyPolicy,
      permitHour:
        permitAmount != null ? { enabled: true, amount: permitAmount } : { enabled: false },
      shortfall:
        shortfallAmount != null ? { enabled: true, amount: shortfallAmount } : { enabled: false }
    };
    const mergedAttendance = override
      ? {
          ...attendance,
          scheduledDays:
            override.scheduled_days != null
              ? Number(override.scheduled_days)
              : attendance.scheduledDays,
          payableDays:
            override.payable_days != null ? Number(override.payable_days) : attendance.payableDays,
          workedHours:
            override.worked_hours != null ? Number(override.worked_hours) : attendance.workedHours,
          permitHours:
            override.permit_hours != null ? Number(override.permit_hours) : attendance.permitHours,
          shortfallHours:
            override.shortfall_hours != null
              ? Number(override.shortfall_hours)
              : attendance.shortfallHours
        }
      : attendance;
    const taxProfile = mapTaxProfile(tax, setting);
    const input: PayrollCalculationInput = {
      salary: { type: assignment.salary_type, amount: parseDbDecimalToMoney(assignment.amount) },
      attendance: mergedAttendance,
      attendancePolicy,
      components,
      manualAdjustments: [],
      tax: {
        ...taxProfile,
        method: settings?.pph21_enabled === false ? 'none' : taxProfile.method,
        ptkp: tax.ptkp_status ? mapPtkpStatusToAmount(tax.ptkp_status) * 100 : taxProfile.ptkp,
        pph21: tax.pph21_method ?? (settings?.pph21_method as Pph21Method | undefined) ?? 'gross'
      },
      bpjs: bpjsInput
    };
    segmentInputs.push(input);
    segmentResults.push({
      result: calculatePayroll(input),
      assignmentId: assignment.id,
      taxId: tax.id,
      start: segmentStart,
      end: segmentEnd,
      benefits: resolveEffectiveRecord(employeeId, segmentStart, benefits),
      bank: resolveEffectiveRecord(employeeId, segmentStart, bankAccounts),
      employmentEvent: resolveEffectiveRecord(
        employeeId,
        segmentStart,
        employmentEvents.map((event) => ({
          id: event.id,
          effective_from: event.effective_date,
          effective_to: null
        }))
      )
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
        if (!period)
          throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
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
          if (duplicate)
            throw new DomainError(
              'Duplicate payroll record for this employee and period.',
              'DUPLICATE_PAYROLL_RECORD'
            );
          const [row] = await tx.insert(payrollRecords).values(record).returning();
          if (!row)
            throw new DomainError(
              'Failed to create payroll record.',
              'PAYROLL_RECORD_CREATE_FAILED'
            );
          const resolvedSegments = record.details.resolvedSegments;
          if (resolvedSegments && resolvedSegments.length > 0) {
            const taxableIncome = resolvedSegments.reduce(
              (sum, segment) => sum + segment.result.tax.taxableIncome,
              0
            );
            const taxAmount = resolvedSegments.reduce(
              (sum, segment) => sum + segment.result.tax.amount,
              0
            );
            await tx.insert(employeeTaxRecords).values({
              employee_id: record.employee_id,
              payroll_record_id: row.id,
              tax_period: period.period_start,
              taxable_income: (taxableIncome / 100).toFixed(2),
              tax_amount: (taxAmount / 100).toFixed(2),
              source: 'calculated',
              is_overridden: false
            });
          }
          created.push(row);
        }
        const [updatedPeriod] = await tx
          .update(payrollPeriods)
          .set({ status: 'processing', updated_at: new Date() })
          .where(and(eq(payrollPeriods.id, period.id), eq(payrollPeriods.status, period.status)))
          .returning();
        if (!updatedPeriod)
          throw new DomainError(
            'Payroll period changed during generation.',
            'PAYROLL_PERIOD_CHANGED'
          );
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

export const getCompanyPayrollSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('payroll', 'edit');
  return JSON.parse(JSON.stringify(await getCompanyPayrollSettings()));
});

export const updateCompanyPayrollSettingsFn = createServerFn({ method: 'POST' })
  .validator(companyPayrollSettingsSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const updated = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.company_settings.update', entityType: 'company_payroll_settings' },
      async (tx) => {
        const existing = await tx.select().from(companyPayrollSettings).limit(1);
        if (existing.length === 0) await tx.insert(companyPayrollSettings).values({});
        const [row] = await tx
          .update(companyPayrollSettings)
          .set({
            company_npwp: data.companyNpwp,
            cut_off_day: data.cutOffDay,
            pph21_enabled: data.pph21Enabled,
            pph21_method: data.pph21Method,
            jkk_enabled: data.jkkEnabled,
            jkm_enabled: data.jkmEnabled,
            jht_enabled: data.jhtEnabled,
            jp_enabled: data.jpEnabled,
            bpjs_kesehatan_enabled: data.bpjsKesehatanEnabled,
            jkk_risk_category: data.jkkRiskCategory,
            jkm_company_rate: data.jkmCompanyRate,
            jht_company_rate: data.jhtCompanyRate,
            jht_employee_rate: data.jhtEmployeeRate,
            jp_company_rate: data.jpCompanyRate,
            jp_employee_rate: data.jpEmployeeRate,
            kesehatan_company_rate: data.kesehatanCompanyRate,
            kesehatan_employee_rate: data.kesehatanEmployeeRate,
            potongan_izin_jam_default: data.potonganIzinJamDefault,
            potongan_shortfall_default: data.potonganShortfallDefault,
            updated_at: new Date()
          })
          .returning();
        if (!row) throw new DomainError('Failed to update company payroll settings.');
        return row;
      }
    );
    return updated;
  });

export const listEmployeeBpjsEnrollmentsFn = createServerFn({ method: 'GET' })
  .validator(employeePayrollProfileReadSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    assertEmployeeScope(session, data.employeeId);
    const enrollments = await listEmployeeBpjsEnrollments(data.employeeId);
    const withFamily = await Promise.all(
      enrollments.map(async (enrollment) => ({
        ...enrollment,
        familyMembers: await listEmployeeBpjsFamilyMembers(enrollment.id)
      }))
    );
    return JSON.parse(
      JSON.stringify(sanitizePayrollProfileForActor(session, { enrollments: withFamily }))
    );
  });

export const upsertEmployeeBpjsEnrollmentFn = createServerFn({ method: 'POST' })
  .validator(bpjsEnrollmentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    assertEmployeeScope(session, data.employeeId);
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.bpjs_enrollment.upsert',
        entityType: 'employee_bpjs_enrollment',
        entityId: data.employeeId
      },
      async (tx) =>
        upsertEmployeeBpjsEnrollment(
          {
            employee_id: data.employeeId,
            program: data.program,
            membership_number: data.membershipNumber ?? '',
            registration_date: data.registrationDate ?? null,
            registered_wage: data.registeredWage,
            jkk_category_override: data.jkkCategoryOverride ?? null,
            is_active: data.isActive,
            effective_from: data.effectiveFrom,
            effective_to: data.effectiveTo ?? null
          },
          tx
        )
    );
  });

export const createEmployeeBpjsFamilyMemberFn = createServerFn({ method: 'POST' })
  .validator(bpjsFamilyMemberSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.bpjs_family_member.create',
        entityType: 'employee_bpjs_family_member'
      },
      async (tx) => {
        const [created] = await tx
          .insert(employeeBpjsFamilyMembers)
          .values({
            enrollment_id: data.enrollmentId,
            name: data.name,
            relationship: data.relationship,
            birth_date: data.birthDate ?? null,
            is_core: data.isCore
          })
          .returning();
        if (!created) throw new DomainError('Failed to create BPJS family member.');
        return created;
      }
    );
  });

export const deleteEmployeeBpjsFamilyMemberFn = createServerFn({ method: 'POST' })
  .validator(bpjsFamilyMemberIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.bpjs_family_member.delete',
        entityType: 'employee_bpjs_family_member',
        entityId: data.id
      },
      async (tx) =>
        (
          await tx
            .delete(employeeBpjsFamilyMembers)
            .where(eq(employeeBpjsFamilyMembers.id, data.id))
            .returning()
        ).length > 0
    );
  });

export const getAttendanceOverrideFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({ payrollPeriodId: z.number().int().positive(), employeeId: z.string().min(1) })
  )
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    assertEmployeeScope(session, data.employeeId);
    return JSON.parse(
      JSON.stringify(await getAttendanceOverride(data.payrollPeriodId, data.employeeId))
    );
  });

export const upsertAttendanceOverrideFn = createServerFn({ method: 'POST' })
  .validator(attendanceOverrideSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const result = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.attendance_override.upsert',
        entityType: 'payroll_attendance_override',
        entityId: data.payrollPeriodId
      },
      async (tx) => {
        const period = await tx
          .select()
          .from(payrollPeriods)
          .where(eq(payrollPeriods.id, data.payrollPeriodId))
          .limit(1);
        if (!period[0])
          throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
        if (period[0].status !== 'draft' && period[0].status !== 'processing')
          throw new DomainError(
            'Attendance overrides require a draft or processing period.',
            'OVERRIDE_NOT_ALLOWED'
          );
        return upsertAttendanceOverride(
          data.payrollPeriodId,
          data.employeeId,
          {
            scheduled_days: data.scheduledDays != null ? String(data.scheduledDays) : undefined,
            payable_days: data.payableDays != null ? String(data.payableDays) : undefined,
            worked_hours: data.workedHours != null ? String(data.workedHours) : undefined,
            permit_hours: data.permitHours != null ? String(data.permitHours) : undefined,
            shortfall_hours: data.shortfallHours != null ? String(data.shortfallHours) : undefined
          },
          session.user.id
        );
      }
    );
    return result;
  });

export const overrideEmployeeTaxRecordFn = createServerFn({ method: 'POST' })
  .validator(taxRecordOverrideSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.tax_record.override',
        entityType: 'employee_tax_record',
        entityId: data.id
      },
      async (tx) => {
        const [row] = await tx
          .update(employeeTaxRecords)
          .set({ tax_amount: data.amount, source: 'manual', is_overridden: true })
          .where(eq(employeeTaxRecords.id, data.id))
          .returning();
        if (!row) throw new DomainError('Tax record was not found.', 'TAX_RECORD_NOT_FOUND');
        return JSON.parse(JSON.stringify(row));
      }
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
        if (!record)
          throw new DomainError('Payroll record was not found.', 'PAYROLL_RECORD_NOT_FOUND');
        const period = await lockPayrollPeriod(tx, record.payroll_period_id);
        if (!period)
          throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
        assertPayrollAdjustmentAllowed(period.status);
        const details =
          record.details && typeof record.details === 'object'
            ? (record.details as Record<string, unknown>)
            : null;
        const input = details?.input;
        if (!input || typeof input !== 'object')
          throw new DomainError(
            'Payroll calculation input is unavailable.',
            'MISSING_PAYROLL_DATA'
          );
        const adjustments = data.adjustments.map((adjustment) => ({
          ...adjustment,
          amount: parseDbDecimalToMoney(adjustment.amount)
        }));
        const existingSegments =
          details?.resolvedSegments && Array.isArray(details.resolvedSegments)
            ? (details.resolvedSegments as Array<{
                assignmentId: number;
                taxId: number;
                start: string;
                end: string;
                benefits: unknown;
                bank: unknown;
                employmentEvent: unknown;
              }>)
            : undefined;
        const existingEmploymentEvents = details?.employmentEvents as unknown[] | undefined;
        const result = Array.isArray(input)
          ? recalculateSegmentsWithAdjustments(
              input,
              adjustments,
              existingSegments,
              existingEmploymentEvents
            )
          : calculatePayroll({
              ...(input as PayrollCalculationInput),
              manualAdjustments: adjustments
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
        if (!updated)
          throw new DomainError(
            'Payroll record changed during adjustment.',
            'PAYROLL_RECORD_CHANGED'
          );
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
      if (!period)
        throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
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
      if (!row)
        throw new DomainError(
          'Payroll period changed during transition.',
          'PAYROLL_PERIOD_CHANGED'
        );
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

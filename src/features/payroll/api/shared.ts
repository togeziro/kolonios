import { and, lte, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DomainError } from '@/lib/errors';
import { calculatePayroll, parseDbDecimalToMoney } from '../utils/calculator';
import type {
  AttendancePolicy,
  ManualAdjustment,
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollProfileActor,
  SalaryComponentInput
} from './types';

export const emptyPolicy: AttendancePolicy = {
  absence: { enabled: true },
  late: { mode: 'none' },
  unpaidLeave: { enabled: true },
  monthlyAttendanceMode: 'prorate',
  permitHour: { enabled: false },
  shortfall: { enabled: false }
};

export function effectiveDuring(
  table: { effective_from: AnyPgColumn; effective_to: AnyPgColumn },
  periodStart: string,
  periodEnd: string
) {
  return and(
    lte(table.effective_from, periodEnd),
    sql`${table.effective_to} is null or ${table.effective_to} >= ${periodStart}`
  )!;
}

export function sumSegmentResults(results: PayrollCalculationResult[]) {
  return results.reduce(
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
}

export function recalculateSegmentsWithAdjustments(
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
  const totals = sumSegmentResults(results);
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

export function isStaffRole(role: string | null | undefined) {
  return ['employee', 'technician', 'user'].includes(role ?? '');
}

export function assertEmployeeScope(actor: PayrollProfileActor, employeeId: string) {
  if (employeeId !== actor.user.id && isStaffRole(actor.user.role)) {
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

export function maskAccountNumber(value: unknown): string | null {
  return typeof value === 'string' && value.length > 4 ? `******${value.slice(-4)}` : null;
}

export function sanitizePayrollProfileForActor<T extends Record<string, unknown>>(
  actor: PayrollProfileActor,
  profile: T
): T {
  if (!isStaffRole(actor.user.role)) return profile;
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

export function dateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function previousDate(value: string) {
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

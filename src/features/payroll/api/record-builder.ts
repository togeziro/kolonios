import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { DomainError } from '@/lib/errors';
import { employeeShifts, leaves, leaveTypeConfigs } from '@/lib/db/schema/attendance';
import {
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeBpjsEnrollments,
  employeeEmploymentEvents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  salaryComponents,
  taxSettings
} from '@/lib/db/schema/payroll';
import {
  getAttendanceOverride,
  getCompanyPayrollSettings,
  getEffectiveSalaryComponents,
  mapPtkpStatusToAmount,
  resolveEffectiveRecord,
  type PayrollTransaction
} from '@/lib/db/payroll';
import { calculatePayroll, JKK_RATES, parseDbDecimalToMoney } from '../utils/calculator';
import type {
  AttendancePolicy,
  BpjsInput,
  BpjsProgram,
  BpjsRates,
  PayrollCalculationInput,
  Pph21Method
} from './types';
import {
  buildAttendanceTotals,
  effectiveDuring,
  emptyPolicy,
  mapSalaryComponent,
  payrollPeriodBoundaries,
  previousDate,
  sumSegmentResults
} from './shared';
import { getScheduledDays } from './scheduled-days';
import { mapTaxProfile } from './tax';

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
        effectiveDuring(employeeSalaryAssignments, period.period_start, period.period_end)
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
        effectiveDuring(employeeTaxProfiles, period.period_start, period.period_end)
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
        effectiveDuring(employeeBenefitEnrollments, period.period_start, period.period_end)
      )
    )) as Array<typeof employeeBenefitEnrollments.$inferSelect>;
  const bankAccounts = (await tx
    .select()
    .from(employeeBankAccounts)
    .where(
      and(
        eq(employeeBankAccounts.employee_id, employeeId),
        eq(employeeBankAccounts.is_primary, true),
        effectiveDuring(employeeBankAccounts, period.period_start, period.period_end)
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
        effectiveDuring(employeeBpjsEnrollments, period.period_start, period.period_end)
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
  const totals = sumSegmentResults(segmentResults.map((segment) => segment.result));
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

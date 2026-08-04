import type {
  AttendancePolicy,
  AttendanceTotals,
  ManualAdjustment,
  Money,
  OvertimeResult,
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollLineItem,
  SalaryComponentInput,
  TaxProfile,
  TaxResult
} from '../api/types';

/** Money is integer minor units. Every derived amount is rounded half-up. */
export function roundMoney(value: number): Money {
  return value < 0 ? Math.ceil(value - 0.5) : Math.floor(value + 0.5);
}

function nonNegative(value: number) {
  return Math.max(0, value);
}

function dailyRate(input: Pick<PayrollCalculationInput, 'salary' | 'attendance'>): Money {
  if (input.salary.type === 'daily') return input.salary.amount;
  if (input.salary.type === 'hourly') {
    return roundMoney(input.salary.amount * (input.salary.dailyHours ?? 8));
  }
  return input.attendance.scheduledDays > 0
    ? roundMoney(input.salary.amount / input.attendance.scheduledDays)
    : 0;
}

export function calculateBaseSalary(input: PayrollCalculationInput): Money {
  const { salary, attendance, attendancePolicy } = input;
  if (salary.type === 'daily')
    return roundMoney(salary.amount * nonNegative(attendance.payableDays));
  if (salary.type === 'hourly')
    return roundMoney(salary.amount * nonNegative(attendance.workedHours));
  if (attendancePolicy.prorateMonthlySalary && attendance.scheduledDays > 0) {
    return roundMoney(
      (salary.amount * nonNegative(attendance.payableDays)) / attendance.scheduledDays
    );
  }
  return roundMoney(salary.amount);
}

function attendanceValue(component: SalaryComponentInput, attendance: AttendanceTotals): number {
  switch (component.attendanceMetric) {
    case 'worked-hours':
      return attendance.workedHours;
    case 'late-count':
      return attendance.lateCount;
    case 'payable-days':
    default:
      return attendance.payableDays;
  }
}

function componentAmount(
  component: SalaryComponentInput,
  baseSalary: Money,
  grossSalary: Money,
  attendance: AttendanceTotals
): Money {
  if (component.mode === 'fixed') return roundMoney(component.amount);
  if (component.mode === 'per-attendance') {
    return roundMoney(component.amount * attendanceValue(component, attendance));
  }
  const base = component.percentageBase === 'gross-salary' ? grossSalary : baseSalary;
  return roundMoney((base * component.amount) / 100);
}

export function calculateAllowances(
  components: SalaryComponentInput[],
  baseSalary: Money,
  attendance: AttendanceTotals
): { total: Money; items: PayrollLineItem[] } {
  let grossSalary = baseSalary;
  const items: PayrollLineItem[] = [];
  for (const component of components.filter((item) => item.type === 'allowance')) {
    const amount = componentAmount(component, baseSalary, grossSalary, attendance);
    grossSalary = roundMoney(grossSalary + amount);
    items.push({
      name: component.name,
      type: 'allowance',
      amount,
      taxable: component.taxable ?? true,
      source: `component:${component.mode}`
    });
  }
  return { total: roundMoney(grossSalary - baseSalary), items };
}

export function calculateDeductions(
  components: SalaryComponentInput[],
  manualAdjustments: ManualAdjustment[],
  baseSalary: Money,
  grossSalary: Money,
  attendance: AttendanceTotals
): { total: Money; items: PayrollLineItem[] } {
  const items: PayrollLineItem[] = [];
  for (const component of components.filter((item) => item.type === 'deduction')) {
    items.push({
      name: component.name,
      type: 'deduction',
      amount: componentAmount(component, baseSalary, grossSalary, attendance),
      taxable: component.taxable ?? false,
      source: `component:${component.mode}`
    });
  }
  for (const adjustment of manualAdjustments) {
    if (adjustment.type === 'deduction') {
      items.push({
        name: adjustment.name,
        type: 'deduction',
        amount: roundMoney(adjustment.amount),
        taxable: adjustment.taxable ?? false,
        source: 'manual'
      });
    }
  }
  return { total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)), items };
}

export function calculateAttendanceDeductions(
  input: Pick<PayrollCalculationInput, 'salary' | 'attendance' | 'attendancePolicy'>
): { total: Money; items: PayrollLineItem[] } {
  const { salary, attendance, attendancePolicy } = input;
  const rate = dailyRate(input);
  const items: PayrollLineItem[] = [];
  const add = (name: string, amount: Money, source: string) => {
    if (amount > 0)
      items.push({ name, type: 'attendance-deduction', amount, taxable: false, source });
  };
  if (attendancePolicy.absence.enabled) {
    add(
      'Absence',
      roundMoney((attendancePolicy.absence.amount ?? rate) * attendance.absentDays),
      'absence'
    );
  }
  if (attendancePolicy.unpaidLeave.enabled) {
    add(
      'Unpaid leave',
      roundMoney((attendancePolicy.unpaidLeave.amount ?? rate) * attendance.unpaidLeaveDays),
      'unpaid-leave'
    );
  }
  if (attendancePolicy.late.mode === 'fixed') {
    add('Late', roundMoney(attendancePolicy.late.amount * attendance.lateCount), 'late:fixed');
  } else if (attendancePolicy.late.mode === 'partial') {
    add(
      'Late',
      roundMoney((rate * attendancePolicy.late.rate * attendance.lateCount) / 100),
      'late:partial'
    );
  }
  return { total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)), items };
}

function applyBrackets(income: Money, brackets: { upTo: Money | null; rate: number }[]) {
  let remaining = nonNegative(income);
  let lower = 0;
  let amount = 0;
  let bracket = 'none';
  for (let index = 0; index < brackets.length && remaining > 0; index += 1) {
    const current = brackets[index]!;
    const width = current.upTo === null ? remaining : Math.min(remaining, current.upTo - lower);
    if (width > 0) {
      amount += (width * current.rate) / 100;
      bracket = String(index);
      remaining -= width;
    }
    lower = current.upTo ?? lower;
  }
  return { amount: roundMoney(amount), bracket };
}

export function calculateProgressiveTax(income: Money, profile: TaxProfile): TaxResult {
  const taxableIncome = nonNegative(roundMoney(income - profile.ptkp));
  const applied = applyBrackets(taxableIncome, profile.settings?.progressive ?? []);
  return {
    method: 'progressive',
    taxableIncome,
    ptkp: profile.ptkp,
    bracket: applied.bracket,
    amount: applied.amount
  };
}

export function calculateTerTax(income: Money, profile: TaxProfile): TaxResult {
  const taxableIncome = nonNegative(roundMoney(income - profile.ptkp));
  const category = profile.category ?? 'default';
  const applied = applyBrackets(taxableIncome, profile.settings?.ter?.[category] ?? []);
  return {
    method: 'ter',
    taxableIncome,
    ptkp: profile.ptkp,
    category,
    bracket: applied.bracket,
    amount: applied.amount
  };
}

export function calculateTax(income: Money, profile: TaxProfile): TaxResult {
  if (profile.method === 'progressive') return calculateProgressiveTax(income, profile);
  if (profile.method === 'ter') return calculateTerTax(income, profile);
  return {
    method: 'none',
    taxableIncome: nonNegative(roundMoney(income - profile.ptkp)),
    ptkp: profile.ptkp,
    amount: 0
  };
}

export function calculateOvertime(): OvertimeResult {
  return { hours: 0, amount: 0, source: 'mvp-disabled' };
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const baseSalary = calculateBaseSalary(input);
  const allowances = calculateAllowances(input.components, baseSalary, input.attendance);
  const grossSalary = roundMoney(baseSalary + allowances.total);
  const deductions = calculateDeductions(
    input.components,
    input.manualAdjustments,
    baseSalary,
    grossSalary,
    input.attendance
  );
  const attendanceDeductions = calculateAttendanceDeductions(input);
  const manualBonuses = input.manualAdjustments
    .filter((adjustment) => adjustment.type === 'bonus')
    .map((adjustment) => ({
      name: adjustment.name,
      type: 'allowance' as const,
      amount: roundMoney(adjustment.amount),
      taxable: adjustment.taxable ?? true,
      source: 'manual'
    }));
  const allowanceTotal = roundMoney(
    allowances.total + manualBonuses.reduce((sum, item) => sum + item.amount, 0)
  );
  const grossWithBonuses = roundMoney(
    grossSalary + manualBonuses.reduce((sum, item) => sum + item.amount, 0)
  );
  const taxableIncome = roundMoney(
    baseSalary +
      [...allowances.items, ...manualBonuses]
        .filter((item) => item.taxable)
        .reduce((sum, item) => sum + item.amount, 0)
  );
  const tax = calculateTax(taxableIncome, input.tax);
  const overtime = calculateOvertime();
  const lineItems: PayrollLineItem[] = [
    {
      name: 'Base salary',
      type: 'base',
      amount: baseSalary,
      taxable: true,
      source: `salary:${input.salary.type}`
    },
    ...allowances.items,
    ...manualBonuses,
    ...deductions.items,
    ...attendanceDeductions.items,
    ...(tax.amount > 0
      ? [
          {
            name: 'Income tax',
            type: 'tax' as const,
            amount: tax.amount,
            taxable: false,
            source: `tax:${tax.method}`
          }
        ]
      : [])
  ];
  const deductionTotal = roundMoney(deductions.total + attendanceDeductions.total + tax.amount);
  const netSalary = nonNegative(roundMoney(grossWithBonuses - deductionTotal));
  const snapshot = {
    input,
    baseSalary,
    allowanceTotal,
    deductionTotal,
    attendanceDeductions: attendanceDeductions.total,
    tax,
    grossSalary: grossWithBonuses,
    netSalary,
    overtime,
    lineItems
  };
  return { ...snapshot, snapshot };
}

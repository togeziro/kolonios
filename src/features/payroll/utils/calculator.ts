import type {
  AttendancePolicy,
  AttendanceTotals,
  BpjsProgram,
  EmployerCost,
  JkkRiskCategory,
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
  if (!Number.isFinite(value)) throw new RangeError('Money calculations must be finite.');
  const normalized = Number(value.toFixed(12));
  const rounded = normalized < 0 ? Math.ceil(normalized - 0.5) : Math.floor(normalized + 0.5);
  if (!Number.isSafeInteger(rounded)) throw new RangeError('Money exceeds the safe integer range.');
  return rounded;
}

function nonNegative(value: number) {
  return Math.max(0, value);
}

export function isMoney(value: unknown): value is Money {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Converts a database numeric with scale 2 into integer minor units. */
export function parseDbDecimalToMoney(value: string): Money {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new RangeError('Database money must be a non-negative decimal with at most 2 decimals.');
  }
  const [whole, fraction = ''] = value.split('.');
  const minor = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  const result = Number(minor);
  if (!isMoney(result)) throw new RangeError('Database money exceeds the safe integer range.');
  return result;
}

function assertNonNegativeFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be non-negative and finite.`);
}

function assertInput(input: PayrollCalculationInput) {
  const moneyValues: [number, string][] = [
    [input.salary.amount, 'salary.amount'],
    [input.tax.ptkp, 'tax.ptkp']
  ];
  for (const component of input.components)
    moneyValues.push([component.amount, `component:${component.name}`]);
  for (const adjustment of input.manualAdjustments) {
    moneyValues.push([adjustment.amount, `adjustment:${adjustment.name}`]);
  }
  if (input.attendancePolicy.absence.amount !== undefined) {
    moneyValues.push([input.attendancePolicy.absence.amount, 'absence.amount']);
  }
  if (input.attendancePolicy.unpaidLeave.amount !== undefined) {
    moneyValues.push([input.attendancePolicy.unpaidLeave.amount, 'unpaidLeave.amount']);
  }
  if (input.attendancePolicy.late.mode === 'fixed') {
    moneyValues.push([input.attendancePolicy.late.amount, 'late.amount']);
  }
  for (const [value, name] of moneyValues) {
    if (!isMoney(value)) throw new RangeError(`${name} must be an integer minor-unit amount.`);
  }
  const attendanceValues: [number, string][] = [
    [input.attendance.scheduledDays, 'scheduledDays'],
    [input.attendance.payableDays, 'payableDays'],
    [input.attendance.workedHours, 'workedHours'],
    [input.attendance.absentDays, 'absentDays'],
    [input.attendance.lateCount, 'lateCount'],
    [input.attendance.unpaidLeaveDays, 'unpaidLeaveDays']
  ];
  for (const [value, name] of attendanceValues) assertNonNegativeFinite(value, name);
  if (input.salary.dailyHours !== undefined)
    assertNonNegativeFinite(input.salary.dailyHours, 'dailyHours');
  if (input.attendancePolicy.late.mode === 'partial') {
    assertNonNegativeFinite(input.attendancePolicy.late.rate, 'late.rate');
  }
  for (const component of input.components) {
    if (component.mode === 'percentage') {
      assertNonNegativeFinite(component.amount, `component:${component.name}.rate`);
    }
  }
  const taxSettings = input.tax.settings;
  for (const brackets of [
    ...(taxSettings?.progressive ? [taxSettings.progressive] : []),
    ...Object.values(taxSettings?.ter ?? {})
  ]) {
    for (const bracket of brackets) {
      if (bracket.upTo !== null && !isMoney(bracket.upTo)) {
        throw new RangeError('Tax bracket limits must be integer minor-unit amounts.');
      }
      assertNonNegativeFinite(bracket.rate, 'tax.rate');
    }
  }
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
  if (
    salary.type === 'monthly' &&
    attendancePolicy.monthlyAttendanceMode === 'prorate' &&
    attendance.scheduledDays > 0
  ) {
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
  grossBase: Money,
  attendance: AttendanceTotals
): Money {
  if (component.mode === 'fixed') return roundMoney(component.amount);
  if (component.mode === 'per-attendance') {
    return roundMoney(component.amount * attendanceValue(component, attendance));
  }
  const base = component.percentageBase === 'gross-salary' ? grossBase : baseSalary;
  return roundMoney((base * component.amount) / 100);
}

function manualBonusItems(manualAdjustments: ManualAdjustment[]): PayrollLineItem[] {
  return manualAdjustments
    .filter((adjustment) => adjustment.type === 'bonus')
    .map((adjustment) => ({
      name: adjustment.name,
      type: 'allowance' as const,
      amount: roundMoney(adjustment.amount),
      taxable: adjustment.taxable ?? true,
      source: 'manual'
    }));
}

function stableGrossBase(
  components: SalaryComponentInput[],
  baseSalary: Money,
  attendance: AttendanceTotals,
  manualBonuses: PayrollLineItem[]
) {
  const componentBase = components
    .filter(
      (component) =>
        component.type === 'allowance' &&
        !(component.mode === 'percentage' && component.percentageBase === 'gross-salary')
    )
    .reduce(
      (sum, component) => sum + componentAmount(component, baseSalary, baseSalary, attendance),
      baseSalary
    );
  return roundMoney(componentBase + manualBonuses.reduce((sum, item) => sum + item.amount, 0));
}

export function calculateAllowances(
  components: SalaryComponentInput[],
  baseSalary: Money,
  attendance: AttendanceTotals,
  manualBonuses: PayrollLineItem[] = []
): { total: Money; items: PayrollLineItem[] } {
  const grossBase = stableGrossBase(components, baseSalary, attendance, manualBonuses);
  const items: PayrollLineItem[] = [];
  for (const component of components.filter((item) => item.type === 'allowance')) {
    const amount = componentAmount(component, baseSalary, grossBase, attendance);
    items.push({
      name: component.name,
      type: 'allowance',
      amount,
      taxable: component.taxable ?? true,
      source: `component:${component.mode}`
    });
  }
  return { total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)), items };
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
  const monthlySeparate =
    salary.type !== 'monthly' || attendancePolicy.monthlyAttendanceMode === 'deduct';
  if (monthlySeparate && attendancePolicy.absence.enabled) {
    add(
      'Absence',
      roundMoney((attendancePolicy.absence.amount ?? rate) * attendance.absentDays),
      'absence'
    );
  }
  if (monthlySeparate && attendancePolicy.unpaidLeave.enabled) {
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

function applyTerRate(income: Money, brackets: { upTo: Money | null; rate: number }[]) {
  const index = brackets.findIndex((bracket) => bracket.upTo === null || income <= bracket.upTo);
  const selected = brackets[index === -1 ? brackets.length - 1 : index];
  if (!selected) return { amount: 0, bracket: 'none' };
  return { amount: roundMoney((income * selected.rate) / 100), bracket: String(index) };
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
  const taxableIncome = nonNegative(roundMoney(income));
  const category = profile.category ?? 'default';
  const applied = applyTerRate(taxableIncome, profile.settings?.ter?.[category] ?? []);
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

const JKK_RATES: Record<JkkRiskCategory, number> = {
  very_low: 0.24,
  low: 0.54,
  medium: 0.89,
  high: 1.27,
  very_high: 1.74
};

export function calculateBpjs(input: Pick<PayrollCalculationInput, 'bpjs'>): {
  deductions: PayrollLineItem[];
  employerCosts: EmployerCost[];
} {
  const bpjs = input.bpjs;
  if (!bpjs) return { deductions: [], employerCosts: [] };
  const deductions: PayrollLineItem[] = [];
  const employerCosts: EmployerCost[] = [];
  for (const enrollment of bpjs.enrollments) {
    if (!bpjs.enabled[enrollment.program]) continue;
    const category =
      enrollment.program === 'jkk' ? (enrollment.jkkCategoryOverride ?? 'low') : undefined;
    let employeeRate = 0;
    let companyRate = 0;
    if (enrollment.program === 'jht') {
      employeeRate = bpjs.rates.jhtEmployee;
      companyRate = bpjs.rates.jhtCompany;
    } else if (enrollment.program === 'jp') {
      employeeRate = bpjs.rates.jpEmployee;
      companyRate = bpjs.rates.jpCompany;
    } else if (enrollment.program === 'kesehatan') {
      employeeRate = bpjs.rates.kesehatanEmployee;
      companyRate = bpjs.rates.kesehatanCompany;
    } else if (enrollment.program === 'jkm') {
      companyRate = bpjs.rates.jkmCompany;
    } else if (enrollment.program === 'jkk') {
      companyRate = JKK_RATES[category!];
    }
    const employeeAmount = roundMoney((enrollment.registeredWage * employeeRate) / 100);
    const companyAmount = roundMoney((enrollment.registeredWage * companyRate) / 100);
    if (employeeAmount > 0)
      deductions.push({
        name: enrollment.program.toUpperCase(),
        type: 'deduction',
        amount: employeeAmount,
        taxable: false,
        source: `bpjs:${enrollment.program}`
      });
    if (companyAmount > 0)
      employerCosts.push({ program: enrollment.program, amount: companyAmount });
  }
  return { deductions, employerCosts };
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  assertInput(input);
  const baseSalary = calculateBaseSalary(input);
  const manualBonuses = manualBonusItems(input.manualAdjustments);
  const allowances = calculateAllowances(
    input.components,
    baseSalary,
    input.attendance,
    manualBonuses
  );
  const grossSalary = roundMoney(
    baseSalary + allowances.total + manualBonuses.reduce((sum, item) => sum + item.amount, 0)
  );
  const deductions = calculateDeductions(
    input.components,
    input.manualAdjustments,
    baseSalary,
    grossSalary,
    input.attendance
  );
  const attendanceDeductions = calculateAttendanceDeductions(input);
  const { deductions: bpjsDeductions, employerCosts } = calculateBpjs(input);
  const allowanceTotal = roundMoney(
    allowances.total + manualBonuses.reduce((sum, item) => sum + item.amount, 0)
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
    ...bpjsDeductions,
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
  const deductionTotal = roundMoney(
    deductions.total +
      attendanceDeductions.total +
      tax.amount +
      bpjsDeductions.reduce((sum, item) => sum + item.amount, 0)
  );
  const netSalary = nonNegative(roundMoney(grossSalary - deductionTotal));
  const snapshot = {
    input,
    baseSalary,
    allowanceTotal,
    deductionTotal,
    attendanceDeductions: attendanceDeductions.total,
    tax,
    grossSalary,
    netSalary,
    overtime,
    lineItems,
    employerCosts
  };
  return { ...snapshot, snapshot };
}

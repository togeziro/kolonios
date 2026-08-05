/** Integer minor units, e.g. 100.00 in storage becomes 10_000 here. */
export type Money = number;
export type SalaryType = 'monthly' | 'daily' | 'hourly';
export type ComponentType = 'allowance' | 'deduction';
export type ComponentMode = 'fixed' | 'percentage' | 'per-attendance';
export type TaxMethod = 'none' | 'progressive' | 'ter';
export type BpjsProgram = 'jkk' | 'jkm' | 'jht' | 'jp' | 'kesehatan';
export type JkkRiskCategory = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type Pph21Method = 'gross' | 'gross_up';

export interface SalaryComponentDefinition {
  id: number;
  code: string;
  name: string;
  type: ComponentType;
  description: string | null;
  is_active: boolean;
}

export interface PayrollProfileActor {
  user: { id: string; role?: string | null };
}

export const PAYROLL_PERIOD_STATUSES = [
  'draft',
  'processing',
  'ready_to_pay',
  'paid',
  'locked'
] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];
export const PAYROLL_EDITABLE_STATUSES: readonly PayrollPeriodStatus[] = ['draft', 'processing'];

export interface PayrollRecordFilters {
  payrollPeriodId?: number;
  employeeId?: string;
  departmentId?: number;
  status?: PayrollPeriodStatus;
  scope?: 'admin' | 'employee';
  page?: number;
  limit?: number;
}

export interface PayrollReportRow {
  id: number;
  payroll_period_id: number;
  employee_id: string;
  gross_salary: string;
  total_allowances: string;
  total_deductions: string;
  net_salary: string;
  details: unknown;
  period_status: PayrollRecordFilters['status'];
  department_name?: string | null;
}

export interface PayrollReportResult {
  rows: PayrollReportRow[];
  gross: number;
  allowances: number;
  deductions: number;
  net: number;
  taxTotal: number;
  departmentTotals: Array<{ department: string; gross: number; net: number }>;
  componentTotals: Array<{ name: string; type: string; amount: number }>;
}

export interface SalaryProfile {
  type: SalaryType;
  amount: Money;
  dailyHours?: number;
}

export interface AttendanceTotals {
  scheduledDays: number;
  payableDays: number;
  workedHours: number;
  absentDays: number;
  lateCount: number;
  unpaidLeaveDays: number;
  permitHours: number;
  shortfallHours: number;
}

export interface AttendancePolicy {
  absence: { enabled: boolean; amount?: Money };
  late: { mode: 'none' } | { mode: 'fixed'; amount: Money } | { mode: 'partial'; rate: number };
  unpaidLeave: { enabled: boolean; amount?: Money };
  permitHour: { enabled: boolean; amount?: Money };
  shortfall: { enabled: boolean; amount?: Money };
  /** Monthly absence/unpaid leave is either prorated into base salary, separately deducted, or ignored. */
  monthlyAttendanceMode: 'none' | 'deduct' | 'prorate';
}

export interface SalaryComponentInput {
  name: string;
  type: ComponentType;
  mode: ComponentMode;
  amount: Money;
  percentageBase?: 'base-salary' | 'gross-salary';
  attendanceMetric?: 'payable-days' | 'worked-hours' | 'late-count';
  taxable?: boolean;
}

export interface ManualAdjustment {
  name: string;
  type: 'bonus' | 'deduction';
  amount: Money;
  taxable?: boolean;
}

export interface ProgressiveTaxBracket {
  upTo: Money | null;
  rate: number;
}

export interface TerTaxBracket {
  upTo: Money | null;
  rate: number;
}

export interface TaxSettings {
  progressive?: ProgressiveTaxBracket[];
  ter?: Record<string, TerTaxBracket[]>;
}

export interface TaxProfile {
  method: TaxMethod;
  ptkp: Money;
  category?: string;
  settings?: TaxSettings;
  pph21?: Pph21Method;
}

export interface PayrollCalculationInput {
  salary: SalaryProfile;
  attendance: AttendanceTotals;
  attendancePolicy: AttendancePolicy;
  components: SalaryComponentInput[];
  manualAdjustments: ManualAdjustment[];
  tax: TaxProfile;
  bpjs?: BpjsInput;
}

export interface PayrollLineItem {
  name: string;
  type: 'base' | 'allowance' | 'deduction' | 'attendance-deduction' | 'tax' | 'overtime';
  amount: Money;
  taxable: boolean;
  source: string;
}

export interface OvertimeResult {
  hours: 0;
  amount: 0;
  source: 'mvp-disabled';
}

export interface TaxResult {
  method: TaxMethod;
  taxableIncome: Money;
  ptkp: Money;
  category?: string;
  bracket?: string;
  amount: Money;
}

export interface PayrollCalculationSnapshot {
  input: PayrollCalculationInput;
  baseSalary: Money;
  allowanceTotal: Money;
  deductionTotal: Money;
  attendanceDeductions: Money;
  tax: TaxResult;
  grossSalary: Money;
  netSalary: Money;
  overtime: OvertimeResult;
  lineItems: PayrollLineItem[];
  employerCosts: EmployerCost[];
}

export interface PayrollCalculationResult {
  baseSalary: Money;
  allowanceTotal: Money;
  deductionTotal: Money;
  attendanceDeductions: Money;
  tax: TaxResult;
  grossSalary: Money;
  netSalary: Money;
  overtime: OvertimeResult;
  lineItems: PayrollLineItem[];
  snapshot: PayrollCalculationSnapshot;
  employerCosts: EmployerCost[];
}

export interface BpjsEnrollmentInput {
  program: BpjsProgram;
  registeredWage: Money;
  jkkCategoryOverride?: JkkRiskCategory;
}

export interface BpjsRates {
  jkk: Record<JkkRiskCategory, number>;
  jkmCompany: number;
  jhtCompany: number;
  jhtEmployee: number;
  jpCompany: number;
  jpEmployee: number;
  kesehatanCompany: number;
  kesehatanEmployee: number;
}

export interface BpjsInput {
  enrollments: BpjsEnrollmentInput[];
  rates: BpjsRates;
  enabled: Record<BpjsProgram, boolean>;
}

export interface EmployerCost {
  program: BpjsProgram;
  amount: Money;
}

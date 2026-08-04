/** Integer minor units, e.g. 100.00 in storage becomes 10_000 here. */
export type Money = number;
export type SalaryType = 'monthly' | 'daily' | 'hourly';
export type ComponentType = 'allowance' | 'deduction';
export type ComponentMode = 'fixed' | 'percentage' | 'per-attendance';
export type TaxMethod = 'none' | 'progressive' | 'ter';

export interface SalaryComponentDefinition {
  id: number;
  code: string;
  name: string;
  type: ComponentType;
  description: string | null;
  is_active: boolean;
}

export interface PayrollRecordFilters {
  payrollPeriodId?: number;
  employeeId?: string;
  departmentId?: number;
  status?: 'draft' | 'processing' | 'ready_to_pay' | 'paid' | 'locked';
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
}

export interface AttendancePolicy {
  absence: { enabled: boolean; amount?: Money };
  late: { mode: 'none' } | { mode: 'fixed'; amount: Money } | { mode: 'partial'; rate: number };
  unpaidLeave: { enabled: boolean; amount?: Money };
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
}

export interface PayrollCalculationInput {
  salary: SalaryProfile;
  attendance: AttendanceTotals;
  attendancePolicy: AttendancePolicy;
  components: SalaryComponentInput[];
  manualAdjustments: ManualAdjustment[];
  tax: TaxProfile;
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
}

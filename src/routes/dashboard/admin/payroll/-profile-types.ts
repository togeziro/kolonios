import { updateEmployeePayrollProfileFn } from '@/features/payroll/api/service';
import type { TaxDraft, TaxRecord } from './-profile-tax-history';
import type { PaymentHistoryRow } from './-profile-payment-history';

export type Assignment = {
  id: number;
  employee_id: string;
  salary_type: 'monthly' | 'daily' | 'hourly';
  amount: string;
  effective_from: string;
  effective_to: string | null;
  department_id: number | null;
  designation_id: number | null;
  overtime_wage_type: 'hourly' | 'daily' | null;
  overtime_rate_workday: string | null;
  overtime_rate_saturday: string | null;
  overtime_rate_sunday: string | null;
  overtime_rate_holiday: string | null;
  leave_hour_deduction: string | null;
  shortfall_hour_deduction: string | null;
  absence_deduction_mode: 'automatic' | 'manual' | null;
};

export type SalaryDetail = {
  id: number;
  assignment_id: number;
  description: string;
  amount: string;
  billing_basis: 'per_month' | 'per_attendance';
};

export type ProfileComponent = {
  component: {
    id: number;
    assignment_id: number;
    salary_component_id: number;
    amount: string;
    mode: 'fixed' | 'percentage' | 'per-attendance';
    percentage_base: 'base-salary' | 'gross-salary' | null;
    attendance_metric: 'payable-days' | 'worked-hours' | 'late-count' | null;
    taxable: boolean;
    effective_from: string;
    effective_to: string | null;
  };
  definition: { id: number; name: string; type: 'allowance' | 'deduction' };
};

export type TaxProfile = {
  id: number;
  tax_setting_id: number | null;
  tax_identifier: string | null;
  filing_status: string | null;
  employment_status: string;
  ptkp_status: string;
  residency: string;
  tax_facility: string;
  tax_object_code: string;
  pph21_method: string | null;
  effective_from: string;
  effective_to: string | null;
};

export type Benefit = {
  id: number;
  benefit_code: string;
  benefit_name: string;
  amount: string | null;
  effective_from: string;
  effective_to: string | null;
  status: string;
};

export type BankAccount = {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  is_primary: boolean;
  effective_from: string;
  effective_to: string | null;
};

export type ProfileData = {
  assignment: Assignment | null;
  assignments: Assignment[];
  salaryDetails: SalaryDetail[];
  components: ProfileComponent[];
  tax: TaxProfile | null;
  taxProfiles: TaxProfile[];
  benefits: Benefit[];
  bank: BankAccount | null;
  bankAccounts: BankAccount[];
  taxRecords: TaxRecord[];
  paymentHistory: PaymentHistoryRow[];
};

export type ComponentDraft = {
  id?: number;
  assignmentId: number;
  salaryComponentId: number;
  amount: string;
  mode: 'fixed' | 'percentage' | 'per-attendance';
  percentageBase: 'base-salary' | 'gross-salary';
  attendanceMetric: 'payable-days' | 'worked-hours' | 'late-count';
  taxable: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

export type BenefitDraft = {
  id?: number;
  benefitCode: string;
  benefitName: string;
  amount: string;
  status: 'active' | 'inactive';
  effectiveFrom: string;
  effectiveTo: string;
};

export type BankDraft = {
  id?: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

export type ProfileMutation = Parameters<typeof updateEmployeePayrollProfileFn>[0]['data'];

export function profileRecordId(id: number | undefined) {
  return id && id > 0 ? id : undefined;
}

export type DraftState = {
  assignment: Assignment | null;
  componentDrafts: Record<number, ComponentDraft>;
  taxDrafts: Record<number, TaxDraft>;
  benefitDrafts: Record<number, BenefitDraft>;
  bankDrafts: Record<number, BankDraft>;
  newComponentDraft: ComponentDraft | null;
  newTaxDraft: TaxDraft | null;
  newBenefitDraft: BenefitDraft | null;
  newBankDraft: BankDraft | null;
};

export function shallowEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function mapEqual<T extends object>(a: Record<number, T>, b: Record<number, T>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (
      !shallowEqual(
        a[Number(key)] as Record<string, unknown>,
        b[Number(key)] as Record<string, unknown>
      )
    )
      return false;
  }
  return true;
}

export function snapshotsEqual(a: DraftState, b: DraftState): boolean {
  return (
    shallowEqual(
      a.assignment as Record<string, unknown> | null,
      b.assignment as Record<string, unknown> | null
    ) &&
    mapEqual(a.componentDrafts, b.componentDrafts) &&
    mapEqual(a.taxDrafts, b.taxDrafts) &&
    mapEqual(a.benefitDrafts, b.benefitDrafts) &&
    mapEqual(a.bankDrafts, b.bankDrafts) &&
    shallowEqual(
      a.newComponentDraft as Record<string, unknown> | null,
      b.newComponentDraft as Record<string, unknown> | null
    ) &&
    shallowEqual(
      a.newTaxDraft as Record<string, unknown> | null,
      b.newTaxDraft as Record<string, unknown> | null
    ) &&
    shallowEqual(
      a.newBenefitDraft as Record<string, unknown> | null,
      b.newBenefitDraft as Record<string, unknown> | null
    ) &&
    shallowEqual(
      a.newBankDraft as Record<string, unknown> | null,
      b.newBankDraft as Record<string, unknown> | null
    )
  );
}

export function draftSnapshotFromData(data: ProfileData): DraftState {
  return {
    assignment: data.assignment,
    componentDrafts: Object.fromEntries(
      data.components.map(({ component }) => [
        component.id,
        {
          id: component.id,
          assignmentId: component.assignment_id,
          salaryComponentId: component.salary_component_id,
          amount: component.amount,
          mode: component.mode,
          percentageBase: component.percentage_base ?? 'base-salary',
          attendanceMetric: component.attendance_metric ?? 'payable-days',
          taxable: component.taxable,
          effectiveFrom: component.effective_from,
          effectiveTo: component.effective_to ?? ''
        }
      ])
    ),
    taxDrafts: Object.fromEntries(
      data.taxProfiles.map((tax) => [
        tax.id,
        {
          id: tax.id,
          taxSettingId: tax.tax_setting_id ?? undefined,
          taxIdentifier: tax.tax_identifier ?? '',
          filingStatus: tax.filing_status ?? '',
          employmentStatus: tax.employment_status as TaxDraft['employmentStatus'],
          ptkpStatus: tax.ptkp_status as TaxDraft['ptkpStatus'],
          residency: tax.residency as TaxDraft['residency'],
          taxFacility: tax.tax_facility as TaxDraft['taxFacility'],
          taxObjectCode: tax.tax_object_code as TaxDraft['taxObjectCode'],
          pph21Method: (tax.pph21_method ?? '') as TaxDraft['pph21Method'],
          effectiveFrom: tax.effective_from,
          effectiveTo: tax.effective_to ?? ''
        }
      ])
    ),
    benefitDrafts: Object.fromEntries(
      data.benefits.map((benefit) => [
        benefit.id,
        {
          id: benefit.id,
          benefitCode: benefit.benefit_code,
          benefitName: benefit.benefit_name,
          amount: benefit.amount ?? '',
          status: benefit.status === 'inactive' ? 'inactive' : 'active',
          effectiveFrom: benefit.effective_from,
          effectiveTo: benefit.effective_to ?? ''
        }
      ])
    ),
    bankDrafts: Object.fromEntries(
      data.bankAccounts.map((bank) => [
        bank.id,
        {
          id: bank.id,
          bankName: bank.bank_name,
          accountName: bank.account_name,
          accountNumber: '',
          isPrimary: bank.is_primary,
          effectiveFrom: bank.effective_from,
          effectiveTo: bank.effective_to ?? ''
        }
      ])
    ),
    newComponentDraft: null,
    newTaxDraft: null,
    newBenefitDraft: null,
    newBankDraft: null
  };
}

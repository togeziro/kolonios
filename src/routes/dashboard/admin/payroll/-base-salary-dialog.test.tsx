// @vitest-environment jsdom
// i18n:skip
import type { TFunction } from 'i18next';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Assignment, ProfileData, SalaryDetail } from './-profile-types';
import {
  BaseSalaryDialog,
  EMPTY_BASE_SALARY_DRAFT,
  baseSalaryDraftsEqual,
  defaultEffectiveFrom,
  draftToBaseSalaryValues,
  profileToBaseSalaryDraft,
  totalPayroll,
  type BaseSalaryDraft
} from './-base-salary-dialog';

function mockT(): TFunction {
  return ((key: string) => key) as unknown as TFunction;
}

type DialogProps = ComponentProps<typeof BaseSalaryDialog>;

function assignmentFixture(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 7,
    employee_id: 'emp-1',
    salary_type: 'monthly',
    amount: '5000000.00',
    effective_from: '2026-01-01',
    effective_to: null,
    department_id: 3,
    designation_id: null,
    overtime_wage_type: 'hourly',
    overtime_rate_workday: '20000.00',
    overtime_rate_saturday: '25000.00',
    overtime_rate_sunday: '30000.00',
    overtime_rate_holiday: '40000.00',
    leave_hour_deduction: '15000.00',
    shortfall_hour_deduction: '10000.00',
    absence_deduction_mode: 'automatic',
    ...overrides
  };
}

function detailFixture(overrides: Partial<SalaryDetail> = {}): SalaryDetail {
  return {
    id: 1,
    assignment_id: 7,
    description: 'Gaji Pokok',
    amount: '4500000.00',
    billing_basis: 'per_month',
    ...overrides
  };
}

function profileFixture(
  overrides: {
    assignment?: Assignment | null;
    salaryDetails?: SalaryDetail[];
  } = {}
): ProfileData {
  return {
    assignment: overrides.assignment === undefined ? assignmentFixture() : overrides.assignment,
    assignments: [],
    salaryDetails: overrides.salaryDetails ?? [detailFixture()],
    components: [],
    tax: null,
    taxProfiles: [],
    benefits: [],
    bank: null,
    bankAccounts: [],
    taxRecords: [],
    paymentHistory: []
  } as ProfileData;
}

function baseProps(overrides: Partial<DialogProps> = {}): DialogProps {
  return {
    open: true,
    employeeName: 'Budi',
    profile: null,
    employees: [
      { id: 'emp-2', full_name: 'Ani' },
      { id: 'emp-3', full_name: 'Citra' }
    ],
    isLoading: false,
    isError: false,
    isSaving: false,
    canEdit: true,
    onSave: () => undefined,
    onAlign: () => undefined,
    onOpenChange: () => undefined,
    t: mockT(),
    ...overrides
  };
}

function saveButton() {
  return screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement;
}

describe('base salary dialog pure helpers', () => {
  it('sums valid nominal values and ignores blanks', () => {
    expect(
      totalPayroll([
        { amount: '4500000' },
        { amount: '100000.5' },
        { amount: '' },
        { amount: 'abc' }
      ])
    ).toBe(4600000.5);
  });

  it('maps a draft to the server payload with numbers and trimmed descriptions', () => {
    const draft: BaseSalaryDraft = {
      ...EMPTY_BASE_SALARY_DRAFT,
      salaryType: 'daily',
      amount: '500000',
      effectiveFrom: '2026-08-01',
      departmentId: 3,
      designationId: null,
      overtimeWageType: 'daily',
      overtimeRateWorkday: '100000',
      overtimeRateSaturday: '150000',
      overtimeRateSunday: '200000',
      overtimeRateHoliday: '250000',
      leaveHourDeduction: '30000',
      shortfallHourDeduction: '20000',
      absenceDeductionMode: 'manual',
      details: [
        { key: -1, description: ' Transport ', amount: '10000', billingBasis: 'per_attendance' },
        { key: -2, description: 'Pokok', amount: '400', billingBasis: 'per_month' }
      ]
    };
    expect(draftToBaseSalaryValues(draft, 'emp-1')).toEqual({
      employeeId: 'emp-1',
      kind: 'base-salary',
      values: {
        salaryType: 'daily',
        amount: 500000,
        effectiveFrom: '2026-08-01',
        effectiveTo: undefined,
        departmentId: 3,
        designationId: null,
        overtimeWageType: 'daily',
        overtimeRateWorkday: 100000,
        overtimeRateSaturday: 150000,
        overtimeRateSunday: 200000,
        overtimeRateHoliday: 250000,
        leaveHourDeduction: 30000,
        shortfallHourDeduction: 20000,
        absenceDeductionMode: 'manual',
        details: [
          { description: 'Transport', amount: 10000, billingBasis: 'per_attendance' },
          { description: 'Pokok', amount: 400, billingBasis: 'per_month' }
        ]
      }
    });
  });

  it('dates a new save after the current version so versioning never collides', () => {
    expect(defaultEffectiveFrom(null)).toBe(new Date().toISOString().slice(0, 10));
    expect(defaultEffectiveFrom({ effective_from: '2026-01-01' })).not.toBe('2026-01-01');
    expect(defaultEffectiveFrom({ effective_from: '2999-12-31' })).toBe('3000-01-01');
  });

  it('detects dirty drafts across every section including detail rows', () => {
    const seeded = profileToBaseSalaryDraft(profileFixture());
    expect(baseSalaryDraftsEqual(seeded, seeded)).toBe(true);
    const edited = {
      ...seeded,
      details: seeded.details.map((detail, index) =>
        index === 0 ? { ...detail, amount: '999' } : detail
      )
    };
    expect(baseSalaryDraftsEqual(seeded, edited)).toBe(false);
    expect(baseSalaryDraftsEqual(seeded, { ...seeded, absenceDeductionMode: 'manual' })).toBe(
      false
    );
  });
});

describe('base salary dialog', () => {
  it('prefills the form from the loaded profile config and details', () => {
    render(<BaseSalaryDialog {...baseProps({ profile: profileFixture() })} />);
    expect((screen.getByLabelText('payroll.salaryType') as HTMLSelectElement).value).toBe(
      'monthly'
    );
    const nominals = screen.getAllByLabelText('payroll.nominal') as HTMLInputElement[];
    expect(nominals[0]?.value).toBe('4500000.00');
    expect(screen.getByText(/payroll.totalPayrollPreview/)).toBeTruthy();
  });

  it('starts empty with defaults when no config exists yet', () => {
    render(<BaseSalaryDialog {...baseProps()} />);
    expect((screen.getByLabelText('payroll.salaryType') as HTMLSelectElement).value).toBe(
      'monthly'
    );
    expect(screen.queryAllByLabelText('payroll.nominal')).toHaveLength(0);
  });

  it('adds detail rows and recomputes the live Total Payroll preview', () => {
    render(<BaseSalaryDialog {...baseProps()} />);
    const preview = screen.getByTestId('total-payroll');
    const before = preview.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
    fireEvent.change(screen.getByLabelText('payroll.detailDescription'), {
      target: { value: 'Transport' }
    });
    fireEvent.change(screen.getByLabelText('payroll.nominal'), {
      target: { value: '100000' }
    });
    expect(screen.getAllByLabelText('payroll.nominal')).toHaveLength(1);
    expect(saveButton().disabled).toBe(false);
    expect(screen.getByTestId('total-payroll').textContent).not.toBe(before);
    fireEvent.click(saveButton());
  });

  it('deletes a detail row via its remove button', () => {
    render(
      <BaseSalaryDialog
        {...baseProps({
          profile: profileFixture({
            salaryDetails: [
              detailFixture(),
              detailFixture({ id: 2, description: 'Transport', amount: '100000.00' })
            ]
          })
        })}
      />
    );
    expect(screen.getAllByLabelText('payroll.detailDescription')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'common.delete' })[0]);
    expect(screen.getAllByLabelText('payroll.detailDescription')).toHaveLength(1);
  });

  it('disables save while loading, saving, on fetch error, or invalid numbers', () => {
    const { rerender } = render(<BaseSalaryDialog {...baseProps({ isLoading: true })} />);
    expect(saveButton().disabled).toBe(true);
    rerender(<BaseSalaryDialog {...baseProps({ isSaving: true })} />);
    expect(saveButton().disabled).toBe(true);
    rerender(<BaseSalaryDialog {...baseProps({ isError: true })} />);
    expect(saveButton().disabled).toBe(true);
    rerender(<BaseSalaryDialog {...baseProps({ canEdit: false })} />);
    expect(saveButton().disabled).toBe(true);
  });

  it('guards an in-progress edit with a discard confirmation before closing', () => {
    const onOpenChange = vi.fn();
    render(<BaseSalaryDialog {...baseProps({ onOpenChange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
    fireEvent.change(screen.getByLabelText('payroll.detailDescription'), {
      target: { value: 'X' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('payroll.discardTitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('payroll.discardTitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'payroll.discardConfirm' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('copies the config to selected employees through onAlign', () => {
    const onAlign = vi.fn();
    render(<BaseSalaryDialog {...baseProps({ onAlign })} />);
    fireEvent.click(screen.getByRole('button', { name: 'payroll.alignWithOthers' }));
    fireEvent.click(screen.getByLabelText('Ani'));
    fireEvent.click(screen.getByRole('button', { name: 'payroll.applyAlign' }));
    expect(onAlign).toHaveBeenCalledWith(['emp-2']);
  });

  it('submits the drafted values through onSave', () => {
    const onSave = vi.fn();
    render(<BaseSalaryDialog {...baseProps({ onSave })} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
    fireEvent.change(screen.getByLabelText('payroll.detailDescription'), {
      target: { value: 'Transport' }
    });
    fireEvent.change(screen.getByLabelText('payroll.nominal'), { target: { value: '100000' } });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      salaryType: 'monthly',
      absenceDeductionMode: 'automatic',
      details: [{ description: 'Transport', billingBasis: 'per_month' }]
    });
  });
});

// @vitest-environment jsdom
// i18n:skip
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PayrollAttendanceOverride } from '@/lib/db/schema/payroll';
import { AttendanceOverrideDialog, draftToOverrideValues } from './-override-dialog';

function mockT(): TFunction {
  return ((key: string) => key) as unknown as TFunction;
}

function overrideRow(
  overrides: Partial<PayrollAttendanceOverride> = {}
): PayrollAttendanceOverride {
  return {
    id: 1,
    payroll_period_id: 2,
    employee_id: 'emp-1',
    scheduled_days: null,
    payable_days: null,
    worked_hours: null,
    permit_hours: null,
    shortfall_hours: null,
    created_by: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides
  };
}

function baseProps() {
  return {
    open: true,
    periodStatus: 'draft' as const,
    row: null,
    isLoading: false,
    isError: false,
    isSaving: false,
    onSave: vi.fn(),
    onOpenChange: vi.fn(),
    t: mockT()
  };
}

function saveButton() {
  return screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement;
}

describe('attendance override dialog', () => {
  it('prefills fields from the fetched override row', () => {
    render(
      <AttendanceOverrideDialog
        {...baseProps()}
        row={overrideRow({
          scheduled_days: '22',
          payable_days: '20',
          worked_hours: '7.5',
          permit_hours: '2',
          shortfall_hours: '1'
        })}
      />
    );
    expect((screen.getByLabelText('payroll.scheduledDays') as HTMLInputElement).value).toBe('22');
    expect((screen.getByLabelText('payroll.payableDays') as HTMLInputElement).value).toBe('20');
    expect((screen.getByLabelText('payroll.workedHours') as HTMLInputElement).value).toBe('7.5');
    expect((screen.getByLabelText('payroll.permitHours') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('payroll.shortfallHours') as HTMLInputElement).value).toBe('1');
  });

  it('keeps fields empty when no override exists yet', () => {
    render(<AttendanceOverrideDialog {...baseProps()} row={null} />);
    expect((screen.getByLabelText('payroll.scheduledDays') as HTMLInputElement).value).toBe('');
    expect(saveButton().disabled).toBe(false);
  });

  it('shows the fetch error and disables save when the override lookup fails', () => {
    render(<AttendanceOverrideDialog {...baseProps()} isError />);
    expect(screen.getByText('payroll.loadFailed')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('disables save while loading or saving', () => {
    const { rerender } = render(<AttendanceOverrideDialog {...baseProps()} isLoading />);
    expect(saveButton().disabled).toBe(true);
    rerender(<AttendanceOverrideDialog {...baseProps()} isSaving />);
    expect(saveButton().disabled).toBe(true);
  });

  it('disables save once the period is paid or locked', () => {
    render(<AttendanceOverrideDialog {...baseProps()} periodStatus='paid' />);
    expect(saveButton().disabled).toBe(true);
  });

  it('submits the drafted values through onSave', () => {
    const onSave = vi.fn();
    render(<AttendanceOverrideDialog {...baseProps()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('payroll.workedHours'), { target: { value: '8' } });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workedHours: '8' }));
  });

  it('maps a draft to API values, turning blank fields into undefined', () => {
    expect(
      draftToOverrideValues({
        scheduledDays: '22',
        payableDays: '  ',
        workedHours: '8.5',
        permitHours: '',
        shortfallHours: ''
      })
    ).toEqual({
      scheduledDays: 22,
      payableDays: undefined,
      workedHours: 8.5,
      permitHours: undefined,
      shortfallHours: undefined
    });
  });
});

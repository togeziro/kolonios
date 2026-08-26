// @vitest-environment jsdom
// i18n:skip
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createPayrollRecordColumns, toHoursMinutes } from './-records-columns';

function mockT(): TFunction {
  return ((key: string) => key) as unknown as TFunction;
}

function columnOptions(overrides: Record<string, unknown> = {}) {
  return {
    t: mockT(),
    canApprove: false,
    canPay: false,
    canLock: false,
    canAdjust: false,
    canOverride: false,
    canEditSalary: false,
    onApprove: vi.fn(),
    onPay: vi.fn(),
    onLock: vi.fn(),
    onAdjust: vi.fn(),
    onOverride: vi.fn(),
    onDetail: vi.fn(),
    onEditSalary: vi.fn(),
    ...overrides
  };
}

describe('payroll record columns', () => {
  it('pins the action column and exposes workflow/detail callbacks', () => {
    const columns = createPayrollRecordColumns(columnOptions());
    const actions = columns.find((column) => column.id === 'actions');
    expect(actions?.enablePinning).toBe(true);
    expect(actions?.meta?.label).toBe('payroll.actions');
  });

  it('renders the inline salary editor trigger only when permitted', () => {
    const record = {
      payroll_period_id: 1,
      employee_id: 'emp-1',
      period_status: 'processing'
    };
    const renderActions = (options: Record<string, unknown>) => {
      const columns = createPayrollRecordColumns(columnOptions(options)) as never as Array<{
        id?: string;
        cell?: (context: { row: { original: unknown } }) => ReactNode;
      }>;
      const actions = columns.find((column) => column.id === 'actions');
      return actions?.cell?.({ row: { original: record } });
    };
    const onEditSalary = vi.fn();
    const { unmount } = render(
      <table>
        <tbody>
          <tr>{renderActions({ canEditSalary: true, onEditSalary })}</tr>
        </tbody>
      </table>
    );
    fireEvent.click(screen.getByRole('button', { name: 'payroll.editBaseSalary' }));
    expect(onEditSalary).toHaveBeenCalledWith(record);
    unmount();
    render(
      <table>
        <tbody>
          <tr>{renderActions({ canEditSalary: false })}</tr>
        </tbody>
      </table>
    );
    expect(screen.queryByRole('button', { name: 'payroll.editBaseSalary' })).toBeNull();
  });

  it('rounds fractional hours to the nearest minute and never carries 60 minutes', () => {
    expect(toHoursMinutes(7.999)).toEqual({ whole: 8, minutes: 0 });
    expect(toHoursMinutes(7.5)).toEqual({ whole: 7, minutes: 30 });
    expect(toHoursMinutes(8)).toEqual({ whole: 8, minutes: 0 });
    expect(toHoursMinutes(40.25)).toEqual({ whole: 40, minutes: 15 });
  });

  it('returns zero hours for null, undefined, or zero', () => {
    expect(toHoursMinutes(null)).toEqual({ whole: 0, minutes: 0 });
    expect(toHoursMinutes(undefined)).toEqual({ whole: 0, minutes: 0 });
    expect(toHoursMinutes(0)).toEqual({ whole: 0, minutes: 0 });
  });

  it('keeps large hour totals', () => {
    expect(toHoursMinutes(160)).toEqual({ whole: 160, minutes: 0 });
  });
});

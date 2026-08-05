import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { createPayrollRecordColumns, toHoursMinutes } from './-records-columns';

function mockT(): TFunction {
  return ((key: string) => key) as unknown as TFunction;
}

describe('payroll record columns', () => {
  it('pins the action column and exposes workflow/detail callbacks', () => {
    const columns = createPayrollRecordColumns({
      t: mockT(),
      canApprove: true,
      canPay: true,
      canLock: true,
      canAdjust: true,
      canOverride: true,
      onApprove: vi.fn(),
      onPay: vi.fn(),
      onLock: vi.fn(),
      onAdjust: vi.fn(),
      onOverride: vi.fn(),
      onDetail: vi.fn()
    });
    const actions = columns.find((column) => column.id === 'actions');
    expect(actions?.enablePinning).toBe(true);
    expect(actions?.meta?.label).toBe('payroll.actions');
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

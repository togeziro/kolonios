import { describe, expect, it, vi } from 'vitest';
import { createPayrollRecordColumns } from './-records-columns';

describe('payroll record columns', () => {
  it('pins the action column and exposes workflow/detail callbacks', () => {
    const columns = createPayrollRecordColumns({
      t: ((key: string) => key) as never,
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
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadPayslip } from './payslip-download';
import type { PayslipData } from './payslip-template';

const labels = {
  payslip: 'Payslip',
  period: 'Period',
  employee: 'Employee',
  employeeCode: 'Employee code',
  department: 'Department',
  designation: 'Designation',
  description: 'Description',
  amount: 'Amount',
  gross: 'Gross',
  allowances: 'Allowances',
  deductions: 'Deductions',
  tax: 'Tax',
  net: 'Net pay',
  bank: 'Bank'
};

const payslip: PayslipData = {
  company: { name: 'Kolonios' },
  employee: { code: 'EMP-0007', name: 'Ari Pratama' },
  period: { name: 'July 2026', start: '2026-07-01', end: '2026-07-31', status: 'locked' },
  gross: '1.00',
  allowances: '0.00',
  deductions: '0.00',
  net: '1.00',
  tax: '0.00',
  lineItems: []
};

describe('downloadPayslip', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads a PDF with the deterministic payslip filename', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    vi.useFakeTimers();
    await expect(downloadPayslip(payslip, labels)).resolves.toBe('payslip-EMP-0007-2026-07.pdf');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
    vi.useRealTimers();
  });
});

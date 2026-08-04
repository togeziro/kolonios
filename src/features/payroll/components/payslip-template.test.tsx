// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PayslipTemplate,
  createPayslipPdf,
  maskPayslipBankAccount,
  type PayslipData
} from './payslip-template';

const payslip: PayslipData = {
  company: { name: 'Kolonios Labs', address: 'Jakarta' },
  employee: {
    code: 'EMP-0007',
    name: 'Ari Pratama',
    department: 'Engineering',
    designation: 'Developer'
  },
  period: { name: 'July 2026', start: '2026-07-01', end: '2026-07-31', status: 'paid' },
  gross: '12,000.00',
  allowances: '1,000.00',
  deductions: '500.00',
  net: '12,500.00',
  tax: '750.00',
  bankAccount: { bankName: 'Bank Example', accountNumber: '1234567890' },
  lineItems: [
    { name: 'Base salary', type: 'earning', amount: '12,000.00' },
    { name: 'Transport', type: 'earning', amount: '1,000.00' },
    { name: 'Insurance', type: 'deduction', amount: '500.00' }
  ]
};

describe('PayslipTemplate', () => {
  it('renders the stored payroll snapshot and masks bank account data', () => {
    render(<PayslipTemplate payslip={payslip} />);

    expect(screen.getByText('Kolonios Labs')).toBeTruthy();
    expect(screen.getByText('Ari Pratama')).toBeTruthy();
    expect(screen.getByText('EMP-0007')).toBeTruthy();
    expect(screen.getByText('July 2026')).toBeTruthy();
    expect(screen.getByText('Base salary')).toBeTruthy();
    expect(screen.getByText('750.00')).toBeTruthy();
    expect(screen.getByText('12,500.00')).toBeTruthy();
    expect(screen.getByText('******7890')).toBeTruthy();
    expect(screen.queryByText('1234567890')).toBeNull();
  });

  it('creates a PDF from the same payslip snapshot with a deterministic filename', async () => {
    const result = await createPayslipPdf(payslip);

    expect(result.filename).toBe('payslip-EMP-0007-2026-07.pdf');
    expect(result.bytes.slice(0, 4)).toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it('masks short and empty account numbers without exposing digits', () => {
    expect(maskPayslipBankAccount('123')).toBe('***');
    expect(maskPayslipBankAccount('')).toBe('***');
  });
});

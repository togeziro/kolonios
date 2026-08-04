// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  PayslipTemplate,
  createPayslipPdf,
  maskPayslipBankAccount,
  payslipFromRecord,
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
    const result = await createPayslipPdf(payslip, labels);

    expect(result.filename).toBe('payslip-EMP-0007-2026-07.pdf');
    expect(result.bytes.slice(0, 4)).toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it('wraps long Unicode line items across pages without throwing', async () => {
    const result = await createPayslipPdf(
      {
        ...payslip,
        employee: { ...payslip.employee, name: '山田 太郎' },
        lineItems: Array.from({ length: 70 }, (_, index) => ({
          name: `交通費項目 ${index} — ${'非常に長い説明 '.repeat(8)}`,
          type: 'earning' as const,
          amount: '10.00'
        }))
      },
      labels
    );

    const document = await PDFDocument.load(result.bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  it('uses the server-provided company profile instead of a client fallback', () => {
    const row = {
      id: 1,
      payroll_period_id: 2,
      gross_salary: '1.00',
      total_allowances: '0.00',
      total_deductions: '0.00',
      net_salary: '1.00',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      period_status: 'paid',
      details: {}
    } as Parameters<typeof payslipFromRecord>[0];

    expect(
      payslipFromRecord(row, { name: 'Configured Company', address: 'Main Street' })?.company
    ).toEqual({
      name: 'Configured Company',
      address: 'Main Street'
    });
  });

  it('sanitizes employee and period filename components', async () => {
    const result = await createPayslipPdf(
      { ...payslip, employee: { ...payslip.employee, code: '../EMP 7/東京' } },
      labels
    );

    expect(result.filename).toBe('payslip-EMP-7-2026-07.pdf');
  });

  it('masks short and empty account numbers without exposing digits', () => {
    expect(maskPayslipBankAccount('123')).toBe('***');
    expect(maskPayslipBankAccount('')).toBe('***');
  });
});

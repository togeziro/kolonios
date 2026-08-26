// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PayslipData } from './payslip-template';
import { PrintablePayslip } from './printable-payslip';

const payslip: PayslipData = {
  company: {
    name: 'PT Koloni Lintas Nusantara',
    address: 'Jl. Merdeka 10, Jakarta',
    email: 'hr@koloni.id',
    phone: '+62 21 555 0100'
  },
  employee: {
    code: 'EMP-0007',
    name: 'Ari Pratama',
    department: 'Engineering',
    designation: 'Developer',
    npwp: '12.345.678.9-012.345'
  },
  period: { name: 'July 2026', start: '2026-07-01', end: '2026-07-31', status: 'paid' },
  gross: 'Rp\u00a01.250.000,00',
  allowances: 'Rp\u00a01.500,00',
  deductions: 'Rp\u00a0500,00',
  net: 'Rp\u00a01.251.000,00',
  earningsTotal: 'Rp\u00a01.251.500,00',
  tax: 'Rp\u00a0750,00',
  bankAccount: { bankName: 'Bank Example', accountNumber: '1234567890' },
  lineItems: [
    { name: 'Base salary', type: 'earning', amount: 'Rp\u00a01.250.000,00' },
    { name: 'Transport', type: 'earning', amount: 'Rp\u00a01.500,00' },
    { name: 'Insurance', type: 'deduction', amount: 'Rp\u00a0500,00' }
  ]
};

describe('PrintablePayslip', () => {
  beforeEach(() => {
    vi.stubGlobal('print', vi.fn());
  });

  it('renders the Kerjoo-style slip: letterhead, title, range, identity with NPWP and raw bank data', () => {
    render(<PrintablePayslip payslip={payslip} periodRange={'08 Jul 2026 - 07 Aug 2026'} />);

    expect(screen.getByText('PT Koloni Lintas Nusantara')).toBeTruthy();
    expect(screen.getByText('Jl. Merdeka 10, Jakarta')).toBeTruthy();
    expect(screen.getByText('hr@koloni.id | +62 21 555 0100')).toBeTruthy();
    expect(screen.getByText(/payslipDocumentTitle/i)).toBeTruthy();
    expect(screen.getByText('08 Jul 2026 - 07 Aug 2026')).toBeTruthy();
    expect(screen.getAllByText('Ari Pratama').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('EMP-0007')).toBeTruthy();
    expect(screen.getByText('12.345.678.9-012.345')).toBeTruthy();
    expect(screen.getByTestId('payslip-account-number').textContent).toBe('1234567890');
    expect(screen.queryByText(/\*{4}/)).toBeNull();
  });

  it('falls back to the record period range and splits earnings from deductions', () => {
    render(<PrintablePayslip payslip={payslip} />);

    expect(screen.getByText('2026-07-01 - 2026-07-31')).toBeTruthy();
    const earnings = screen.getByTestId('payslip-earnings');
    const deductions = screen.getByTestId('payslip-deductions');
    expect(earnings.textContent).toContain('Base salary');
    expect(earnings.textContent).toContain('Transport');
    expect(earnings.textContent).not.toContain('Insurance');
    expect(deductions.textContent).toContain('Insurance');
    expect(deductions.textContent).not.toContain('Base salary');
    expect(screen.getByTestId('payslip-total-received').textContent).toContain(
      'Rp\u00a01.251.000,00'
    );
  });

  it('prints through the browser dialog', () => {
    render(<PrintablePayslip payslip={payslip} />);

    fireEvent.click(screen.getByRole('button'));
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});

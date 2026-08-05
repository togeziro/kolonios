import { describe, expect, it } from 'vitest';
import { maskBankAccount, formatPayrollMoney } from './-components';

describe('payroll admin display helpers', () => {
  it('masks bank account numbers while preserving the final four digits', () => {
    expect(maskBankAccount('1234567890')).toBe('******7890');
    expect(maskBankAccount('123')).toBe('***');
  });

  it('formats stored decimal payroll amounts as currency', () => {
    expect(formatPayrollMoney('1250000.50')).toContain('1,250,000.50');
  });
});

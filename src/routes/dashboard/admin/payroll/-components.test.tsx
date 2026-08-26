// @vitest-environment jsdom
// i18n:skip
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { maskBankAccount, formatPayrollMoney, PayQueueSummaryBar } from './-components';

function mockT(): TFunction {
  const strings: Record<string, string> = {
    'payroll.payQueue.selectedChip': '{{count}} dipilih · {{amount}}'
  };
  return ((key: string, opts?: Record<string, unknown>) => {
    let out = strings[key] ?? key;
    for (const [name, value] of Object.entries(opts ?? {})) {
      out = out.replace(`{{${name}}}`, String(value));
    }
    return out;
  }) as unknown as TFunction;
}

describe('payroll admin display helpers', () => {
  it('masks bank account numbers while preserving the final four digits', () => {
    expect(maskBankAccount('1234567890')).toBe('******7890');
    expect(maskBankAccount('123')).toBe('***');
  });

  it('formats stored decimal payroll amounts as currency in the app locale', () => {
    expect(formatPayrollMoney('1250000.50')).toBe('Rp\u00A01.250.000,50');
  });
});

describe('pay queue summary bar', () => {
  it('renders the queue totals without a selection chip when nothing is selected', () => {
    render(
      <PayQueueSummaryBar
        t={mockT()}
        totalNet='6500000'
        employeeCount={3}
        selectedCount={0}
        selectedNet='0'
      />
    );
    // Intl may render the currency separator as U+202F under jsdom's ICU;
    // compare against the same formatter output instead of a literal.
    const money = formatPayrollMoney('6500000');
    expect(screen.getByText((_, element) => element?.textContent === money)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByTestId('pay-queue-selection-chip')).toBeNull();
  });

  it('shows the live selection chip once rows are ticked', () => {
    render(
      <PayQueueSummaryBar
        t={mockT()}
        totalNet='6500000'
        employeeCount={3}
        selectedCount={2}
        selectedNet='5500000'
      />
    );
    const chip = screen.getByTestId('pay-queue-selection-chip');
    expect(chip.textContent).toContain('2');
    expect(chip.textContent).toContain(formatPayrollMoney('5500000'));
  });
});

import { describe, expect, it } from 'vitest';
import { calculatePayroll, roundMoney } from './calculator';
import type { PayrollCalculationInput } from '../api/types';

const baseInput = (overrides: Partial<PayrollCalculationInput> = {}): PayrollCalculationInput => ({
  salary: { type: 'monthly', amount: 10_000_000 },
  attendance: {
    scheduledDays: 20,
    payableDays: 20,
    workedHours: 160,
    absentDays: 0,
    lateCount: 0,
    unpaidLeaveDays: 0
  },
  attendancePolicy: {
    absence: { enabled: false },
    late: { mode: 'none' },
    unpaidLeave: { enabled: false }
  },
  components: [],
  manualAdjustments: [],
  tax: { method: 'none', ptkp: 0 },
  ...overrides
});

describe('calculatePayroll', () => {
  it('rounds derived money amounts half-up in integer minor units', () => {
    expect(roundMoney(1.5)).toBe(2);
    expect(roundMoney(1.49)).toBe(1);
    expect(roundMoney(-1.5)).toBe(-2);
  });

  it('calculates monthly salary without attendance proration', () => {
    const result = calculatePayroll(
      baseInput({
        attendance: { ...baseInput().attendance, scheduledDays: 20, payableDays: 18, absentDays: 2 }
      })
    );

    expect(result.baseSalary).toBe(10_000_000);
    expect(result.attendanceDeductions).toBe(0);
    expect(result.netSalary).toBe(10_000_000);
  });

  it('calculates daily salary from payable attendance and hourly salary from worked hours', () => {
    expect(
      calculatePayroll(
        baseInput({
          salary: { type: 'daily', amount: 500_000 },
          attendance: { ...baseInput().attendance, payableDays: 18 }
        })
      ).baseSalary
    ).toBe(9_000_000);
    expect(
      calculatePayroll(
        baseInput({
          salary: { type: 'hourly', amount: 75_000 },
          attendance: { ...baseInput().attendance, workedHours: 150 }
        })
      ).baseSalary
    ).toBe(11_250_000);
  });

  it('calculates fixed, percentage, and per-attendance components with taxability', () => {
    const result = calculatePayroll(
      baseInput({
        components: [
          { name: 'Transport', type: 'allowance', mode: 'fixed', amount: 500_000, taxable: false },
          {
            name: 'Meal',
            type: 'allowance',
            mode: 'percentage',
            amount: 10,
            percentageBase: 'base-salary',
            taxable: true
          },
          {
            name: 'Attendance bonus',
            type: 'allowance',
            mode: 'per-attendance',
            amount: 25_000,
            attendanceMetric: 'payable-days',
            taxable: true
          },
          {
            name: 'Insurance',
            type: 'deduction',
            mode: 'percentage',
            amount: 5,
            percentageBase: 'base-salary',
            taxable: false
          }
        ]
      })
    );

    expect(result.allowanceTotal).toBe(2_000_000);
    expect(result.deductionTotal).toBe(500_000);
    expect(result.grossSalary).toBe(12_000_000);
    expect(result.lineItems.find((item) => item.name === 'Transport')?.taxable).toBe(false);
  });

  it('applies configurable absence, late, and unpaid-leave deductions', () => {
    const result = calculatePayroll(
      baseInput({
        attendance: {
          ...baseInput().attendance,
          payableDays: 17,
          absentDays: 2,
          lateCount: 3,
          unpaidLeaveDays: 1
        },
        attendancePolicy: {
          absence: { enabled: true },
          late: { mode: 'fixed', amount: 50_000 },
          unpaidLeave: { enabled: true }
        }
      })
    );

    expect(result.attendanceDeductions).toBe(1_650_000);
    expect(result.deductionTotal).toBe(1_650_000);
    expect(result.netSalary).toBe(8_350_000);
  });

  it('supports partial late deductions as a percentage of the daily salary', () => {
    const result = calculatePayroll(
      baseInput({
        attendance: { ...baseInput().attendance, lateCount: 2 },
        attendancePolicy: {
          absence: { enabled: false },
          late: { mode: 'partial', rate: 25 },
          unpaidLeave: { enabled: false }
        }
      })
    );

    expect(result.attendanceDeductions).toBe(250_000);
  });

  it('includes manual bonuses and deductions and keeps overtime disabled', () => {
    const result = calculatePayroll(
      baseInput({
        manualAdjustments: [
          { name: 'Correction bonus', type: 'bonus', amount: 125_000, taxable: true },
          { name: 'Cash advance', type: 'deduction', amount: 75_000, taxable: false }
        ]
      })
    );

    expect(result.allowanceTotal).toBe(125_000);
    expect(result.deductionTotal).toBe(75_000);
    expect(result.overtime).toEqual({ hours: 0, amount: 0, source: 'mvp-disabled' });
    expect(result.netSalary).toBe(10_050_000);
  });

  it('dispatches progressive tax and records its calculation details', () => {
    const result = calculatePayroll(
      baseInput({
        tax: {
          method: 'progressive',
          ptkp: 3_000_000,
          settings: {
            progressive: [
              { upTo: 5_000_000, rate: 5 },
              { upTo: null, rate: 10 }
            ]
          }
        }
      })
    );

    expect(result.tax).toMatchObject({
      method: 'progressive',
      taxableIncome: 7_000_000,
      ptkp: 3_000_000,
      amount: 450_000
    });
    expect(result.netSalary).toBe(9_550_000);
  });

  it('dispatches TER tax by category and rate', () => {
    const result = calculatePayroll(
      baseInput({
        tax: {
          method: 'ter',
          ptkp: 0,
          category: 'A',
          settings: { ter: { A: [{ upTo: 20_000_000, rate: 5 }] } }
        }
      })
    );

    expect(result.tax).toMatchObject({
      method: 'ter',
      category: 'A',
      taxableIncome: 10_000_000,
      amount: 500_000
    });
    expect(result.netSalary).toBe(9_500_000);
  });

  it('prorates monthly salary only when configured and clamps net salary at zero', () => {
    const result = calculatePayroll(
      baseInput({
        salary: { type: 'monthly', amount: 10_000_000 },
        attendance: { ...baseInput().attendance, scheduledDays: 20, payableDays: 10 },
        attendancePolicy: {
          absence: { enabled: true },
          late: { mode: 'none' },
          unpaidLeave: { enabled: false },
          prorateMonthlySalary: true
        },
        manualAdjustments: [{ name: 'Large deduction', type: 'deduction', amount: 20_000_000 }]
      })
    );

    expect(result.baseSalary).toBe(5_000_000);
    expect(result.netSalary).toBe(0);
  });

  it('returns a JSON-serializable snapshot containing the calculation inputs and outputs', () => {
    const result = calculatePayroll(baseInput());

    expect(() => JSON.stringify(result.snapshot)).not.toThrow();
    expect(result.snapshot).toMatchObject({ grossSalary: 10_000_000, netSalary: 10_000_000 });
    expect(result.snapshot).not.toHaveProperty('snapshot');
  });
});

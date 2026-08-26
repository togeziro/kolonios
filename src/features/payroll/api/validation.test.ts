import { describe, expect, it } from 'vitest';
import {
  employeePayrollProfileSchema,
  moneySchema,
  payrollPeriodSchema,
  payrollRecordFiltersSchema,
  reportFiltersSchema
} from './validation';
import { payrollRecordAdjustmentSchema } from './validation';

describe('payroll validation', () => {
  it('accepts decimal money and normalizes it to a database decimal', () => {
    expect(moneySchema.parse('1250.5')).toBe('1250.50');
  });

  it('rejects a period whose end precedes its start', () => {
    expect(() =>
      payrollPeriodSchema.parse({
        name: 'July',
        periodStart: '2026-07-31',
        periodEnd: '2026-07-01'
      })
    ).toThrow();
  });

  it('requires a payment date on payroll periods', () => {
    expect(() =>
      payrollPeriodSchema.parse({
        name: 'July',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31'
      })
    ).toThrow();
    expect(
      payrollPeriodSchema.parse({
        name: 'July',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        paymentDate: '2026-08-05'
      }).paymentDate
    ).toBe('2026-08-05');
  });

  it('requires an employee id for employee-scoped record reads', () => {
    expect(() => payrollRecordFiltersSchema.parse({ scope: 'employee' })).toThrow();
  });

  it('validates every payroll profile section instead of accepting arbitrary records', () => {
    expect(() =>
      employeePayrollProfileSchema.parse({ employeeId: 'e1', kind: 'bank', values: {} })
    ).toThrow();
    expect(() =>
      employeePayrollProfileSchema.parse({ employeeId: 'e1', kind: 'benefit', values: {} })
    ).toThrow();
    expect(() =>
      employeePayrollProfileSchema.parse({
        employeeId: 'e1',
        kind: 'assignment',
        values: { salaryType: 'monthly', amount: '100.00', effectiveFrom: '2026-01-01' }
      })
    ).not.toThrow();
  });

  it('accepts only explicitly implemented report formats', () => {
    expect(reportFiltersSchema.parse({ format: 'csv' }).format).toBe('csv');
    expect(reportFiltersSchema.parse({ format: 'xlsx' }).format).toBe('xlsx');
  });

  it('validates manual adjustments as bounded money entries', () => {
    expect(() =>
      payrollRecordAdjustmentSchema.parse({
        id: 1,
        adjustments: [{ name: '', type: 'bonus', amount: '1.00' }]
      })
    ).toThrow();
    expect(
      payrollRecordAdjustmentSchema.parse({
        id: 1,
        adjustments: [{ name: 'Bonus', type: 'bonus', amount: '1.00' }]
      }).adjustments[0]?.amount
    ).toBe('1.00');
  });

  it('accepts new effective-dated profile records alongside existing history', () => {
    for (const [kind, values] of [
      ['component', { assignmentId: 1, salaryComponentId: 2, amount: '10.00' }],
      ['tax', { taxIdentifier: 'NPWP-2', filingStatus: 'TK/0' }],
      ['benefit', { benefitCode: 'BPJS-K', benefitName: 'Health' }],
      ['bank', { bankName: 'Bank', accountName: 'Employee', accountNumber: '1234' }]
    ] as const) {
      expect(() =>
        employeePayrollProfileSchema.parse({
          employeeId: 'e1',
          kind,
          values: { ...values, effectiveFrom: '2027-01-01' }
        })
      ).not.toThrow();
    }
  });
});

describe('base salary profile kind', () => {
  const validValues = {
    salaryType: 'monthly',
    amount: '5000000',
    effectiveFrom: '2026-08-01',
    overtimeWageType: 'hourly',
    overtimeRateWorkday: '20000',
    overtimeRateSaturday: '25000',
    overtimeRateSunday: '30000',
    overtimeRateHoliday: '40000',
    leaveHourDeduction: '15000',
    shortfallHourDeduction: '10000',
    absenceDeductionMode: 'automatic',
    details: [
      { description: 'Gaji Pokok', amount: '4500000', billingBasis: 'per_month' },
      { description: 'Transport', amount: '100000', billingBasis: 'per_attendance' }
    ]
  } as const;

  it('accepts the full Set Base Salary payload with salary details and rates', () => {
    const parsed = employeePayrollProfileSchema.parse({
      employeeId: 'emp-1',
      kind: 'base-salary',
      values: validValues
    });
    if (parsed.kind !== 'base-salary') throw new Error('wrong union branch');
    expect(parsed.values.amount).toBe('5000000.00');
    expect(parsed.values.details[1]?.billingBasis).toBe('per_attendance');
    expect(parsed.values.overtimeRateHoliday).toBe('40000.00');
  });

  it('details default to per-month billing and an empty details list is allowed', () => {
    const parsed = employeePayrollProfileSchema.parse({
      employeeId: 'emp-1',
      kind: 'base-salary',
      values: { ...validValues, details: [{ description: 'Gaji Pokok', amount: 1 }] }
    });
    if (parsed.kind !== 'base-salary') throw new Error('wrong union branch');
    expect(parsed.values.details[0]?.billingBasis).toBe('per_month');
    expect(
      employeePayrollProfileSchema.parse({
        employeeId: 'emp-1',
        kind: 'base-salary',
        values: { ...validValues, details: undefined }
      }).kind
    ).toBe('base-salary');
  });

  it('rejects unknown overtime wage types, absence modes, and detail bases', () => {
    expect(() =>
      employeePayrollProfileSchema.parse({
        employeeId: 'emp-1',
        kind: 'base-salary',
        values: { ...validValues, overtimeWageType: 'weekly' }
      })
    ).toThrow();
    expect(() =>
      employeePayrollProfileSchema.parse({
        employeeId: 'emp-1',
        kind: 'base-salary',
        values: { ...validValues, absenceDeductionMode: 'hybrid' }
      })
    ).toThrow();
    expect(() =>
      employeePayrollProfileSchema.parse({
        employeeId: 'emp-1',
        kind: 'base-salary',
        values: {
          ...validValues,
          details: [{ description: 'X', amount: '1', billingBasis: 'per_year' }]
        }
      })
    ).toThrow();
  });

  it('bounds the number of salary detail rows and rejects blank descriptions', () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      description: `Row ${index}`,
      amount: '1'
    }));
    expect(() =>
      employeePayrollProfileSchema.parse({
        employeeId: 'emp-1',
        kind: 'base-salary',
        values: { ...validValues, details: rows }
      })
    ).toThrow();
    expect(() =>
      employeePayrollProfileSchema.parse({
        employeeId: 'emp-1',
        kind: 'base-salary',
        values: { ...validValues, details: [{ description: '   ', amount: '1' }] }
      })
    ).toThrow();
  });

  it('keeps rejecting assignment saves without the new fields untouched', () => {
    expect(() =>
      employeePayrollProfileSchema.parse({
        employeeId: 'e1',
        kind: 'assignment',
        values: { salaryType: 'monthly', amount: '100.00', effectiveFrom: '2026-01-01' }
      })
    ).not.toThrow();
  });
});

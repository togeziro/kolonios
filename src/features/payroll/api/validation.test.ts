import { describe, expect, it } from 'vitest';
import {
  employeePayrollProfileSchema,
  moneySchema,
  payrollPeriodSchema,
  payrollRecordFiltersSchema,
  reportFiltersSchema
} from './validation';

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
    expect(() => reportFiltersSchema.parse({ format: 'xlsx' })).toThrow();
  });
});

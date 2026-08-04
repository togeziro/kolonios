import { describe, expect, it } from 'vitest';
import { moneySchema, payrollPeriodSchema, payrollRecordFiltersSchema } from './validation';

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
});

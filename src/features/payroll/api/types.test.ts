import { describe, expect, it } from 'vitest';
import { PAYROLL_EDITABLE_STATUSES, PAYROLL_PERIOD_STATUSES } from './types';

describe('payroll period statuses', () => {
  it('declares all five statuses in schema enum order', () => {
    expect(PAYROLL_PERIOD_STATUSES).toEqual([
      'draft',
      'processing',
      'ready_to_pay',
      'paid',
      'locked'
    ]);
  });

  it('marks draft and processing as editable statuses', () => {
    expect(PAYROLL_EDITABLE_STATUSES).toEqual(['draft', 'processing']);
  });
});

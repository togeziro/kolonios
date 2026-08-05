import { describe, expect, it } from 'vitest';
import { canPayrollAction } from './permissions';

describe('payroll client permissions', () => {
  it('allows administrators and only granted payroll actions', () => {
    expect(canPayrollAction({}, true, 'delete')).toBe(true);
    expect(canPayrollAction({ payroll: { edit: true } }, false, 'edit')).toBe(true);
    expect(canPayrollAction({ payroll: { edit: true } }, false, 'approve')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { assertEmployeeScope } from './service';

describe('payroll service boundaries', () => {
  it('prevents staff users from reading another employee payroll profile', () => {
    expect(() =>
      assertEmployeeScope({ user: { id: 'employee-1', role: 'employee' } }, 'employee-2')
    ).toThrow(/forbidden/i);
  });

  it('allows HR to operate on another employee payroll profile', () => {
    expect(() =>
      assertEmployeeScope({ user: { id: 'hr-1', role: 'hr' } }, 'employee-2')
    ).not.toThrow();
  });
});

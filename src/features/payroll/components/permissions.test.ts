import { describe, expect, it } from 'vitest';
import { canPayrollAction, settingsSaveDisabled } from './permissions';

describe('payroll client permissions', () => {
  it('allows administrators and only granted payroll actions', () => {
    expect(canPayrollAction({}, true, 'delete')).toBe(true);
    expect(canPayrollAction({ payroll: { edit: true } }, false, 'edit')).toBe(true);
    expect(canPayrollAction({ payroll: { edit: true } }, false, 'approve')).toBe(false);
  });
});

describe('company payroll settings save gate', () => {
  it('enables save for a fresh company (no settings row yet) with edit rights', () => {
    expect(settingsSaveDisabled(true, false)).toBe(false);
  });

  it('disables save without edit rights or while a save is pending', () => {
    expect(settingsSaveDisabled(false, false)).toBe(true);
    expect(settingsSaveDisabled(true, true)).toBe(true);
  });
});

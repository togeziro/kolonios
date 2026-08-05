import { describe, expect, it } from 'vitest';
import { filterBottomNavItems } from './bottom-nav';

describe('filterBottomNavItems', () => {
  it('hides payslips without payroll.view and keeps it for permitted staff', () => {
    const items = [
      { icon: (() => null) as never, labelKey: 'home', to: '/home', module: undefined },
      { icon: (() => null) as never, labelKey: 'payslips', to: '/payslips', module: 'payroll' }
    ] as never;

    expect(filterBottomNavItems(items, { payroll: { view: false } })).toHaveLength(1);
    expect(filterBottomNavItems(items, { payroll: { view: true } })).toHaveLength(2);
    expect(filterBottomNavItems(items, undefined, true)).toHaveLength(2);
  });
});

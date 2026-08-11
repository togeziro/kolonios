import { describe, expect, it } from 'vitest';
import { computeBreadcrumbs } from './use-breadcrumbs';

const t = (key: string) => key;

function titles(pathname: string) {
  return computeBreadcrumbs(pathname, t).map((item) => item.title);
}

describe('computeBreadcrumbs', () => {
  it('drops the admin URL segment and maps holiday-calendar', () => {
    expect(computeBreadcrumbs('/dashboard/admin/holiday-calendar', t)).toEqual([
      { title: 'navigation.dashboard', link: '/dashboard' },
      { title: 'navigation.holidayCalendar', link: '/dashboard/admin/holiday-calendar' }
    ]);
  });

  it('produces unique titles on settings pages (no duplicate Settings)', () => {
    const crumbs = computeBreadcrumbs('/dashboard/admin/holiday-calendar/settings', t);
    expect(titles('/dashboard/admin/holiday-calendar/settings')).toEqual([
      'navigation.dashboard',
      'navigation.holidayCalendar',
      'navigation.settings'
    ]);
    expect(new Set(crumbs.map((c) => c.title)).size).toBe(crumbs.length);
  });

  it('keeps payroll settings breadcrumbs unique', () => {
    expect(titles('/dashboard/admin/payroll/settings')).toEqual([
      'navigation.dashboard',
      'navigation.payroll',
      'navigation.settings'
    ]);
  });

  it('drops admin from audit log breadcrumbs', () => {
    expect(titles('/dashboard/admin/audit-log')).toEqual([
      'navigation.dashboard',
      'navigation.auditLog'
    ]);
  });

  it('uses the custom route mapping when present', () => {
    expect(titles('/dashboard/admin/payroll/profile')).toEqual([
      'navigation.dashboard',
      'navigation.payroll',
      'payroll.profile'
    ]);
  });

  it('dedupes consecutive identical titles', () => {
    expect(titles('/dashboard/settings/settings')).toEqual([
      'navigation.dashboard',
      'navigation.settings'
    ]);
  });
});

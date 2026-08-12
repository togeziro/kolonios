import { describe, expect, it } from 'vitest';
import { resolveHomePath, resolveShell } from './resolve';

const group = (overrides: Partial<{ name: string; is_admin: boolean }> = {}) => ({
  name: 'Employee',
  is_admin: false,
  ...overrides
});

describe('resolveShell', () => {
  it('maps customers to portal regardless of role group', () => {
    expect(resolveShell({ role: 'customer', roleGroup: null })).toBe('portal');
  });

  it('maps admin role group (is_admin) to backoffice', () => {
    expect(
      resolveShell({ role: 'admin', roleGroup: group({ name: 'Administrator', is_admin: true }) })
    ).toBe('backoffice');
  });

  it('maps HR role group to backoffice', () => {
    expect(resolveShell({ role: 'hr', roleGroup: group({ name: 'HR' }) })).toBe('backoffice');
  });

  it('maps Technician role group to fieldops and Employee to backoffice', () => {
    expect(resolveShell({ role: 'employee', roleGroup: group({ name: 'Employee' }) })).toBe(
      'backoffice'
    );
    expect(resolveShell({ role: 'technician', roleGroup: group({ name: 'Technician' }) })).toBe(
      'fieldops'
    );
  });

  it('falls back to legacy role when no role group is assigned', () => {
    expect(resolveShell({ role: 'admin', roleGroup: null })).toBe('backoffice');
    expect(resolveShell({ role: 'hr', roleGroup: null })).toBe('backoffice');
    expect(resolveShell({ role: 'employee', roleGroup: null })).toBe('backoffice');
    expect(resolveShell({ role: 'technician', roleGroup: null })).toBe('fieldops');
    expect(resolveShell({ role: undefined, roleGroup: null })).toBe('backoffice');
  });

  it('treats unknown custom role groups as backoffice', () => {
    expect(resolveShell({ role: 'employee', roleGroup: group({ name: 'Finance' }) })).toBe(
      'backoffice'
    );
  });
});

describe('resolveHomePath', () => {
  it('routes customers to the portal', () => {
    expect(resolveHomePath('customer')).toBe('/portal');
  });

  it('routes everyone else to the dashboard overview', () => {
    expect(resolveHomePath('admin')).toBe('/dashboard/overview');
    expect(resolveHomePath(undefined)).toBe('/dashboard/overview');
  });
});

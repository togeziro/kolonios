import { describe, expect, it } from 'vitest';
import { navGroups } from './nav-config';
import { filterNavGroupsByRole } from '@/hooks/use-nav';
import type { Permissions } from '@/features/role-groups/api/types';

function allUrls(groups: typeof navGroups) {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => [item.url, ...(item.items ?? []).map((sub) => sub.url)])
  );
}

function allTitles(groups: typeof navGroups) {
  return groups.flatMap((group) => group.items.map((item) => item.title));
}

describe('nav-config', () => {
  it('does not expose demo/showcase pages in production navigation', () => {
    const urls = allUrls(navGroups);
    for (const demoPrefix of [
      '/dashboard/forms',
      '/dashboard/react-query',
      '/dashboard/elements'
    ]) {
      expect(urls.some((url) => url.startsWith(demoPrefix))).toBe(false);
    }
  });

  it('has Overview group with core items', () => {
    const overview = navGroups.find((g) => g.label === 'Overview');
    expect(overview).toBeDefined();
    const titles = overview!.items.map((item) => item.title);
    expect(titles).toContain('Dashboard');
    expect(titles).toContain('My Work');
    expect(titles).toContain('Attendance');
    expect(titles).toContain('Leave');
    expect(titles).toContain('Profile');
  });

  it('has Management group with data-management items', () => {
    const management = navGroups.find((g) => g.label === 'Management');
    expect(management).toBeDefined();
    const titles = management!.items.map((item) => item.title);
    expect(titles).toContain('Customers');
    expect(titles).toContain('Employees');
  });

  it('has Settings group with admin items', () => {
    const settings = navGroups.find((g) => g.label === 'Settings');
    expect(settings).toBeDefined();
    const titles = settings!.items.map((item) => item.title);
    expect(titles).toContain('Users');
    expect(titles).toContain('Departments');
    expect(titles).toContain('Job Titles');
    expect(titles).toContain('Audit Log');
    expect(titles).toContain('Role Groups');
  });

  it('every nav item has a module key', () => {
    for (const group of navGroups) {
      for (const item of group.items) {
        expect(item.module).toBeDefined();
        expect(typeof item.module).toBe('string');
      }
    }
  });

  it('has exactly three groups', () => {
    const labels = navGroups.map((g) => g.label);
    expect(labels).toEqual(['Overview', 'Management', 'Settings']);
  });

  it('does not include removed product pages', () => {
    const urls = allUrls(navGroups);
    expect(urls).not.toContain('/dashboard/product');
  });
});

describe('filterNavGroupsByRole', () => {
  const technicianPerms: Permissions = {
    overview: { view: true },
    my_work: { view: true },
    attendance: { view: true },
    leave: { view: true },
    profile: { view: true }
  };

  const fullPerms: Permissions = {
    overview: { view: true },
    my_work: { view: true },
    attendance: { view: true },
    leave: { view: true },
    profile: { view: true },
    customers: { view: true, add: true, edit: true },
    employees: { view: true },
    users: { view: true, add: true, edit: true, delete: true },
    departments: { view: true },
    designations: { view: true },
    audit_log: { view: true },
    role_groups: { view: true, add: true, edit: true, delete: true }
  };

  it('is_admin sees all groups and all items', () => {
    const filtered = filterNavGroupsByRole(navGroups, technicianPerms, true);
    const labels = filtered.map((g) => g.label);
    expect(labels).toContain('Overview');
    expect(labels).toContain('Management');
    expect(labels).toContain('Settings');
  });

  it('non-admin with limited permissions sees only matching modules', () => {
    const filtered = filterNavGroupsByRole(navGroups, technicianPerms, false);
    const labels = filtered.map((g) => g.label);
    // Technician has attendance view permission, but the attendance admin
    // items in Management now require the attendance_admin module, so only
    // the Overview group remains visible.
    expect(labels).toEqual(['Overview']);
    const titles = allTitles(filtered);
    expect(titles).toContain('Dashboard');
    expect(titles).toContain('My Work');
    expect(titles).not.toContain('Attendance Locations');
    expect(titles).not.toContain('Users');
  });

  it('non-admin with full permissions sees everything', () => {
    const filtered = filterNavGroupsByRole(navGroups, fullPerms, false);
    const labels = filtered.map((g) => g.label);
    expect(labels).toContain('Management');
    expect(labels).toContain('Settings');
  });

  it('returns all groups when no permissions provided', () => {
    const filtered = filterNavGroupsByRole(navGroups);
    expect(filtered.map((g) => g.label)).toEqual(['Overview', 'Management', 'Settings']);
  });

  it('hides modules not in permissions', () => {
    const filtered = filterNavGroupsByRole(navGroups, { overview: { view: true } }, false);
    const titles = allTitles(filtered);
    expect(titles).toEqual(['Dashboard']);
  });

  it('empty permissions hides all module-gated items', () => {
    const filtered = filterNavGroupsByRole(navGroups, {}, false);
    expect(filtered).toEqual([]);
  });
});

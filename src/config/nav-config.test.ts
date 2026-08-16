import { describe, expect, it } from 'vitest';
import { navItems } from './nav-config';
import { filterNavItemsByRole } from '@/hooks/use-nav';
import type { Permissions } from '@/features/role-groups/api/types';
import type { NavItem } from '@/types';

function topLevelTitles(items: NavItem[]) {
  return items.map((item) => item.title);
}

function allUrls(items: NavItem[]) {
  return items.flatMap((item) => [item.url, ...(item.items ?? []).map((sub) => sub.url)]);
}

describe('nav-config', () => {
  it('is a flat Kerjoo-ordered list of top-level items', () => {
    expect(topLevelTitles(navItems)).toEqual([
      'Dashboard',
      'Employees',
      'Customers',
      'Tickets',
      'My Work',
      'Attendance',
      'Schedule',
      'Leave',
      'Payroll',
      'Payslips',
      'Broadcast',
      'Attendance Management',
      'Holiday Calendar',
      'Settings',
      'Review Queue',
      'Leave Approvals',
      'Profile'
    ]);
  });

  it('flags employee self-service items hidden for admins', () => {
    const hidden = navItems.filter((item) => item.hiddenForAdmin).map((item) => item.title);
    expect(hidden).toEqual(['My Work', 'Attendance', 'Schedule', 'Payslips', 'Profile']);
  });

  it('includes SPV-only review queue and leave approvals items', () => {
    const reviewQueue = navItems.find((item) => item.title === 'Review Queue');
    const leaveApprovals = navItems.find((item) => item.title === 'Leave Approvals');
    expect(reviewQueue).toBeDefined();
    expect(reviewQueue!.module).toBe('spv_review');
    expect(reviewQueue!.url).toBe('/dashboard/spv/review');
    expect(leaveApprovals).toBeDefined();
    expect(leaveApprovals!.module).toBe('spv_review');
    expect(leaveApprovals!.url).toBe('/dashboard/spv/leave-approvals');
  });

  it('nests tickets pages under a Tickets dropdown', () => {
    const tickets = navItems.find((item) => item.title === 'Tickets');
    const children = tickets?.items?.map((item) => item.title) ?? [];
    expect(children).toEqual(['Available Jobs', 'New Ticket']);
    expect(tickets!.module).toBe('tickets');
    const urls = tickets?.items?.map((item) => item.url) ?? [];
    expect(urls).toEqual(['/dashboard/jobs', '/dashboard/tickets/new']);
  });

  it('nests payroll admin pages under a Payroll dropdown', () => {
    const payroll = navItems.find((item) => item.title === 'Payroll');
    const children = payroll?.items?.map((item) => item.title) ?? [];
    expect(children).toEqual(['Payroll', 'Payroll Profiles', 'Payroll Settings']);
  });

  it('nests attendance admin pages under an Attendance Management dropdown', () => {
    const attendance = navItems.find((item) => item.title === 'Attendance Management');
    const children = attendance?.items?.map((item) => item.title) ?? [];
    expect(children).toEqual([
      'Attendance Locations',
      'Attendance Schedules',
      'Attendance Assignments',
      'Attendance Reports'
    ]);
  });

  it('nests holiday pages under a Holiday Calendar dropdown', () => {
    const holiday = navItems.find((item) => item.title === 'Holiday Calendar');
    const children = holiday?.items?.map((item) => item.title) ?? [];
    expect(children).toEqual(['Holiday Calendar', 'Holiday Settings']);
  });

  it('nests the work log settings page under a Settings dropdown', () => {
    const settings = navItems.find((item) => item.title === 'Settings');
    const children = settings?.items?.map((item) => item.title) ?? [];
    const urls = settings?.items?.map((item) => item.url) ?? [];
    expect(children).toContain('Work Log Settings');
    expect(urls).toContain('/dashboard/admin/worklog-settings');
    const workLog = settings?.items?.find((item) => item.title === 'Work Log Settings');
    expect(workLog?.module).toBe('settings');
  });

  it('gates dropdown parents by their module so children inherit access', () => {
    const payroll = navItems.find((item) => item.title === 'Payroll');
    const attendance = navItems.find((item) => item.title === 'Attendance Management');
    expect(payroll!.module).toBe('payroll');
    expect(attendance!.module).toBe('attendance_admin');
    for (const child of [...(payroll!.items ?? []), ...(attendance!.items ?? [])]) {
      expect(child.module).toBeDefined();
    }
  });

  it('every nav item has a module key', () => {
    for (const item of navItems) {
      expect(item.module).toBeDefined();
      expect(typeof item.module).toBe('string');
      for (const sub of item.items ?? []) {
        expect(sub.module).toBeDefined();
        expect(typeof sub.module).toBe('string');
      }
    }
  });

  it('does not expose demo/showcase pages or removed product pages', () => {
    const urls = allUrls(navItems);
    for (const forbiddenPrefix of [
      '/dashboard/forms',
      '/dashboard/react-query',
      '/dashboard/elements',
      '/dashboard/product'
    ]) {
      expect(urls.some((url) => url.startsWith(forbiddenPrefix))).toBe(false);
    }
  });
});

describe('filterNavItemsByRole', () => {
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
    schedule: { view: true },
    leave: { view: true },
    profile: { view: true },
    customers: { view: true, add: true, edit: true },
    employees: { view: true },
    payroll: { view: true },
    broadcast: { view: true },
    attendance_admin: { view: true },
    holiday: { view: true },
    users: { view: true },
    departments: { view: true },
    designations: { view: true },
    audit_log: { view: true },
    role_groups: { view: true },
    tickets: { view: true, add: true },
    jobs: { view: true },
    spv_review: { view: true, edit: true }
  };

  it('admin sees everything except employee self-service items', () => {
    const filtered = filterNavItemsByRole(navItems, technicianPerms, true);
    expect(topLevelTitles(filtered)).toEqual([
      'Dashboard',
      'Employees',
      'Customers',
      'Tickets',
      'Leave',
      'Payroll',
      'Broadcast',
      'Attendance Management',
      'Holiday Calendar',
      'Settings',
      'Review Queue',
      'Leave Approvals'
    ]);
  });

  it('non-admin with limited permissions sees only matching modules', () => {
    const filtered = filterNavItemsByRole(navItems, technicianPerms, false);
    expect(topLevelTitles(filtered)).toEqual([
      'Dashboard',
      'My Work',
      'Attendance',
      'Leave',
      'Profile'
    ]);
  });

  it('SPV sees Review Queue and Leave Approvals when spv_review module is granted', () => {
    const spvPerms: Permissions = {
      ...technicianPerms,
      spv_review: { view: true, edit: true }
    };
    const filtered = filterNavItemsByRole(navItems, spvPerms, false);
    const titles = topLevelTitles(filtered);
    expect(titles).toContain('Review Queue');
    expect(titles).toContain('Leave Approvals');
  });

  it('non-SPV does not see Review Queue or Leave Approvals', () => {
    const filtered = filterNavItemsByRole(navItems, technicianPerms, false);
    const titles = topLevelTitles(filtered);
    expect(titles).not.toContain('Review Queue');
    expect(titles).not.toContain('Leave Approvals');
  });

  it('non-admin with full permissions sees everything', () => {
    const filtered = filterNavItemsByRole(navItems, fullPerms, false);
    expect(topLevelTitles(filtered)).toEqual(topLevelTitles(navItems));
  });

  it('returns all items when no permissions provided', () => {
    expect(topLevelTitles(filterNavItemsByRole(navItems))).toEqual(topLevelTitles(navItems));
  });

  it('hides modules not in permissions', () => {
    const filtered = filterNavItemsByRole(navItems, { overview: { view: true } }, false);
    expect(topLevelTitles(filtered)).toEqual(['Dashboard']);
  });

  it('empty permissions hides all module-gated items', () => {
    expect(filterNavItemsByRole(navItems, {}, false)).toEqual([]);
  });
});

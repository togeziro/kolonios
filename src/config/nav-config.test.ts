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
    expect(reviewQueue!.module).toBe('checklist');
    expect(reviewQueue!.requiredAction).toBe('approve');
    expect(reviewQueue!.url).toBe('/dashboard/spv/review');
    expect(leaveApprovals).toBeDefined();
    expect(leaveApprovals!.module).toBe('spv_review');
    expect(leaveApprovals!.url).toBe('/dashboard/spv/leave-approvals');
  });

  it('nests tickets pages under a Tickets dropdown', () => {
    const tickets = navItems.find((item) => item.title === 'Tickets');
    const children = tickets?.items?.map((item) => item.title) ?? [];
    expect(children).toEqual(['All Tickets', 'Available Jobs', 'New Ticket']);
    expect(tickets!.module).toBe('tickets');
    const urls = tickets?.items?.map((item) => item.url) ?? [];
    expect(urls).toEqual(['/dashboard/tickets', '/dashboard/jobs', '/dashboard/tickets/new']);
  });

  it('nests payroll admin pages under a Payroll dropdown', () => {
    const payroll = navItems.find((item) => item.title === 'Payroll');
    const children = payroll?.items?.map((item) => item.title) ?? [];
    expect(children).toEqual(['Payroll', 'Ready to Pay', 'Payroll Profiles', 'Payroll Settings']);
    expect(payroll?.items?.map((item) => item.url)).toContain(
      '/dashboard/admin/payroll/ready-to-pay'
    );
  });

  it('nests attendance admin pages under an Attendance Management dropdown', () => {
    const attendance = navItems.find((item) => item.title === 'Attendance Management');
    const children = attendance?.items?.map((item) => item.title) ?? [];
    expect(children).toEqual([
      'Attendance Locations',
      'Attendance Schedules',
      'Schedule Grid',
      'Attendance Assignments',
      'Attendance Reports',
      'Attendance Face Settings'
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

  it('nests Branding under a Settings dropdown gated by settings module', () => {
    const settings = navItems.find((item) => item.title === 'Settings');
    const branding = settings?.items?.find((item) => item.title === 'Branding');
    expect(branding).toBeDefined();
    expect(branding?.url).toBe('/dashboard/settings');
    expect(branding?.module).toBe('settings');
  });

  it('is visible through the Settings group to any user who sees the group (children are filtered by module)', () => {
    // Sub-menu entries obey the same canAccessItem rule as top-level items:
    // users.view alone keeps the Users child but drops Branding (settings).
    const perms: Permissions = { users: { view: true } };
    const settings = filterNavItemsByRole(navItems, perms, false).find(
      (item) => item.title === 'Settings'
    );
    expect(settings?.items?.map((item) => item.title)).toEqual(['Users']);
  });

  it('hides the whole Settings group (with Branding) from non-admins without users.view', () => {
    const settings = filterNavItemsByRole(
      navItems,
      { settings: { view: true, edit: true } },
      false
    ).find((item) => item.title === 'Settings');
    expect(settings).toBeUndefined();
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
    spv_review: { view: true, edit: true },
    checklist: { view: true, edit: true, approve: true }
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

  it('SPV sees Review Queue and Leave Approvals when spv_review and checklist.approve are granted', () => {
    const spvPerms: Permissions = {
      ...technicianPerms,
      spv_review: { view: true, edit: true },
      checklist: { view: true, edit: true, approve: true }
    };
    const filtered = filterNavItemsByRole(navItems, spvPerms, false);
    const titles = topLevelTitles(filtered);
    expect(titles).toContain('Review Queue');
    expect(titles).toContain('Leave Approvals');
  });

  it('spv_review.view without checklist.approve hides Review Queue but shows Leave Approvals', () => {
    const spvPerms: Permissions = {
      ...technicianPerms,
      spv_review: { view: true, edit: true }
    };
    const filtered = filterNavItemsByRole(navItems, spvPerms, false);
    const titles = topLevelTitles(filtered);
    expect(titles).not.toContain('Review Queue');
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

  it('filters sub-menu items with the same canAccessItem rule (HR case)', () => {
    // HR seed grants users.view (shared by the Settings parent and its Users
    // child) but not role_groups.view nor storage.view: those two children
    // disappear from the sub-menu.
    const hrPerms: Permissions = {
      overview: { view: true },
      employees: { view: true },
      users: { view: true },
      settings: { view: true, edit: true }
    };
    const settings = filterNavItemsByRole(navItems, hrPerms, false).find(
      (item) => item.title === 'Settings'
    );
    const titles = settings?.items?.map((item) => item.title) ?? [];
    expect(titles).toContain('Users');
    expect(titles).not.toContain('Role Groups');
    expect(titles).not.toContain('Storage Settings');
  });

  it('hides a parent grouping whose children are all filtered out', () => {
    // Synthetic grouping (the real config never orphans a parent this way:
    // every dropdown keeps at least one child sharing the parent's module).
    // The group passes its own gate but both children belong to other modules.
    const items: NavItem[] = [
      {
        title: 'Group',
        url: '/dashboard/group',
        icon: 'settings',
        isActive: false,
        module: 'users',
        items: [
          {
            title: 'Child A',
            url: '/dashboard/group/a',
            icon: 'settings',
            isActive: false,
            module: 'role_groups',
            items: []
          },
          {
            title: 'Child B',
            url: '/dashboard/group/b',
            icon: 'settings',
            isActive: false,
            module: 'storage',
            items: []
          }
        ]
      }
    ];
    expect(filterNavItemsByRole(items, { users: { view: true } }, false)).toEqual([]);
  });

  it('keeps a parent that is itself a link even when children are filtered', () => {
    // The Tickets parent links to /dashboard/tickets with module
    // 'tickets'; with tickets.view (but no jobs.view) the parent survives
    // and only the Available Jobs child is dropped.
    const perms: Permissions = { tickets: { view: true } };
    const tickets = filterNavItemsByRole(navItems, perms, false).find(
      (item) => item.title === 'Tickets'
    );
    expect(tickets).toBeDefined();
    expect(tickets?.items?.map((item) => item.title)).toEqual(['All Tickets', 'New Ticket']);
  });

  it('preserves mixed-visibility children in order', () => {
    const perms: Permissions = {
      users: { view: true },
      settings: { view: true },
      audit_log: { view: true },
      role_groups: { view: true }
    };
    const settings = filterNavItemsByRole(navItems, perms, false).find(
      (item) => item.title === 'Settings'
    );
    expect(settings?.items?.map((item) => item.title)).toEqual([
      'Users',
      'Audit Log',
      'Role Groups',
      'Work Log Settings',
      'Rate Limit Settings',
      'Branding'
    ]);
  });

  it('applies hiddenForAdmin to sub-menu items', () => {
    const adminNav = filterNavItemsByRole(navItems, fullPerms, true);
    const adminSettings = adminNav.find((item) => item.title === 'Settings');
    for (const child of adminSettings?.items ?? []) {
      expect(child.hiddenForAdmin ?? false).toBe(false);
    }
  });

  it('filters nested children recursively (grandchildren of sub-items)', () => {
    // NavItem recursion: a sub-item that itself has children must also be
    // filtered by the same rule; here the grandchild lacks jobs.view.
    const withGrandchild: NavItem[] = [
      {
        title: 'Tickets',
        url: '/dashboard/tickets/new',
        icon: 'workspace',
        isActive: false,
        module: 'tickets',
        items: [
          {
            title: 'Wrapper',
            url: '/dashboard/tickets/wrapper',
            icon: 'workspace',
            isActive: false,
            module: 'tickets',
            items: [
              {
                title: 'Hidden Grandchild',
                url: '/dashboard/tickets/hidden',
                icon: 'workspace',
                isActive: false,
                module: 'jobs',
                items: []
              },
              {
                title: 'Visible Grandchild',
                url: '/dashboard/tickets/visible',
                icon: 'workspace',
                isActive: false,
                module: 'tickets',
                items: []
              }
            ]
          }
        ]
      }
    ];
    const filtered = filterNavItemsByRole(withGrandchild, { tickets: { view: true } }, false);
    expect(filtered).toHaveLength(1);
    const wrapper = filtered[0].items?.[0];
    expect(wrapper?.items?.map((item) => item.title)).toEqual(['Visible Grandchild']);
  });

  it('does not mutate the input items (originals keep their children)', () => {
    const perms: Permissions = { tickets: { view: true } };
    filterNavItemsByRole(navItems, perms, false);
    const tickets = navItems.find((item) => item.title === 'Tickets');
    expect(tickets?.items?.map((item) => item.title)).toEqual([
      'All Tickets',
      'Available Jobs',
      'New Ticket'
    ]);
  });
});

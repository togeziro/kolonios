import { describe, expect, it } from 'vitest';
import { ROUTE_REGISTRY, resolveRouteGuard } from './route-guard';

describe('resolveRouteGuard', () => {
  it('returns the registered module.action for exact dashboard paths', () => {
    expect(resolveRouteGuard('/dashboard/overview')).toEqual({
      module: 'overview',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/employees')).toEqual({
      module: 'employees',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/customers')).toEqual({
      module: 'customers',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/users')).toEqual({
      module: 'users',
      action: 'view'
    });
  });

  it('maps payroll generate/settings to edit and reports to reports', () => {
    expect(resolveRouteGuard('/dashboard/admin/payroll/generate')).toEqual({
      module: 'payroll',
      action: 'edit'
    });
    expect(resolveRouteGuard('/dashboard/admin/payroll/settings')).toEqual({
      module: 'payroll',
      action: 'edit'
    });
    expect(resolveRouteGuard('/dashboard/admin/payroll/reports')).toEqual({
      module: 'payroll',
      action: 'reports'
    });
    expect(resolveRouteGuard('/dashboard/admin/payroll')).toEqual({
      module: 'payroll',
      action: 'view'
    });
  });

  it('maps payroll records print (dynamic id) to payroll.view', () => {
    expect(resolveRouteGuard('/dashboard/admin/payroll/records/abc123/print')).toEqual({
      module: 'payroll',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/admin/payroll/records')).toEqual({
      module: 'payroll',
      action: 'view'
    });
  });

  it('maps admin attendance management routes to attendance_admin.edit', () => {
    const adminAttendancePaths = [
      '/dashboard/admin/attendance/assignments',
      '/dashboard/admin/attendance/schedules',
      '/dashboard/admin/attendance/locations',
      '/dashboard/admin/attendance/reports',
      '/dashboard/admin/attendance/face-settings'
    ];
    for (const path of adminAttendancePaths) {
      expect(resolveRouteGuard(path)).toEqual({
        module: 'attendance_admin',
        action: 'edit'
      });
    }
  });

  it('maps role-group detail (dynamic id) to role_groups.view', () => {
    expect(resolveRouteGuard('/dashboard/admin/role-groups')).toEqual({
      module: 'role_groups',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/admin/role-groups/role-123')).toEqual({
      module: 'role_groups',
      action: 'view'
    });
  });

  it('maps SPV review and leave approvals to spv_review.view', () => {
    expect(resolveRouteGuard('/dashboard/spv/review')).toEqual({
      module: 'spv_review',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/spv/review/ticket-42')).toEqual({
      module: 'spv_review',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/spv/leave-approvals')).toEqual({
      module: 'spv_review',
      action: 'view'
    });
  });

  it('maps tickets flow (new, detail, completed, work-session, en-route) to tickets.view', () => {
    const ticketPaths = [
      '/dashboard/tickets/new',
      '/dashboard/tickets/abc',
      '/dashboard/tickets/abc/completed',
      '/dashboard/work-session/abc',
      '/dashboard/work-session/abc/handoff',
      '/dashboard/en-route/abc'
    ];
    for (const path of ticketPaths) {
      expect(resolveRouteGuard(path)).toEqual({ module: 'tickets', action: 'view' });
    }
  });

  it('maps personal/technician pages to their modules', () => {
    const expectations: Array<[string, string]> = [
      ['/dashboard/leave', 'leave'],
      ['/dashboard/schedule', 'schedule'],
      ['/dashboard/achievements', 'achievements'],
      ['/dashboard/daily-checklist', 'checklist'],
      ['/dashboard/my-work', 'my_work'],
      ['/dashboard/jobs', 'jobs'],
      ['/dashboard/attendance', 'attendance'],
      ['/dashboard/attendance/check-in', 'attendance'],
      ['/dashboard/profile', 'profile'],
      ['/dashboard/edit-profile', 'profile'],
      ['/dashboard/change-password', 'profile'],
      ['/dashboard/notifications', 'notifications'],
      ['/dashboard/payroll/payslips', 'payslips']
    ];
    for (const [path, module] of expectations) {
      expect(resolveRouteGuard(path), `${path} should map to ${module}`).toEqual({
        module,
        action: 'view'
      });
    }
  });

  it('returns "unregistered" for any dashboard path with no registry entry (fail-closed)', () => {
    expect(resolveRouteGuard('/dashboard/this-does-not-exist')).toBe('unregistered');
    expect(resolveRouteGuard('/dashboard/admin/something-new')).toBe('unregistered');
    expect(resolveRouteGuard('/dashboard/admin/payroll/unknown')).toBe('unregistered');
    expect(resolveRouteGuard('/dashboard/overview/unknown')).toBe('unregistered');
  });

  it('returns null for non-dashboard paths (passthrough)', () => {
    expect(resolveRouteGuard('/portal')).toBeNull();
    expect(resolveRouteGuard('/auth/v2/sign-in')).toBeNull();
    expect(resolveRouteGuard('/api/v1/auth/sign-in/email')).toBeNull();
    expect(resolveRouteGuard('/')).toBeNull();
  });

  it('treats trailing slashes equivalently to the bare path', () => {
    expect(resolveRouteGuard('/dashboard/employees/')).toEqual({
      module: 'employees',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard/')).toEqual({
      module: 'overview',
      action: 'view'
    });
    expect(resolveRouteGuard('/dashboard')).toEqual({
      module: 'overview',
      action: 'view'
    });
  });

  it('does not match dashboard paths against non-dashboard lookalikes', () => {
    expect(resolveRouteGuard('/dashboards')).toBeNull();
    expect(resolveRouteGuard('/dashboardx')).toBeNull();
    expect(resolveRouteGuard('/dashboards/employees')).toBeNull();
  });

  it('covers every current dashboard route (registry exhaustiveness)', () => {
    // Sanity check: enumerate the routes the audit produced and assert each
    // resolves (not "unregistered"). The audit lives in
    // `.scratch/route-guard-matrix/spec.md` § "Further Notes".
    const auditedPaths = [
      '/dashboard',
      '/dashboard/overview',
      '/dashboard/profile',
      '/dashboard/edit-profile',
      '/dashboard/change-password',
      '/dashboard/notifications',
      '/dashboard/employees',
      '/dashboard/customers',
      '/dashboard/users',
      '/dashboard/admin/role-groups',
      '/dashboard/admin/role-groups/any-id',
      '/dashboard/admin/audit-log',
      '/dashboard/admin/broadcast',
      '/dashboard/admin/departments',
      '/dashboard/admin/designations',
      '/dashboard/admin/storage-settings',
      '/dashboard/admin/worklog-settings',
      '/dashboard/admin/rate-limit',
      '/dashboard/admin/holiday-calendar',
      '/dashboard/admin/holiday-calendar/settings',
      '/dashboard/admin/attendance/assignments',
      '/dashboard/admin/attendance/schedules',
      '/dashboard/admin/attendance/locations',
      '/dashboard/admin/attendance/reports',
      '/dashboard/admin/attendance/face-settings',
      '/dashboard/admin/payroll',
      '/dashboard/admin/payroll/profile',
      '/dashboard/admin/payroll/periods',
      '/dashboard/admin/payroll/ready-to-pay',
      '/dashboard/admin/payroll/records',
      '/dashboard/admin/payroll/records/abc/print',
      '/dashboard/admin/payroll/generate',
      '/dashboard/admin/payroll/settings',
      '/dashboard/admin/payroll/reports',
      '/dashboard/payroll/payslips',
      '/dashboard/attendance',
      '/dashboard/attendance/check-in',
      '/dashboard/attendance/face-settings',
      '/dashboard/leave',
      '/dashboard/schedule',
      '/dashboard/achievements',
      '/dashboard/daily-checklist',
      '/dashboard/my-work',
      '/dashboard/jobs',
      '/dashboard/settings',
      '/dashboard/spv/review',
      '/dashboard/spv/review/any-ticket',
      '/dashboard/spv/leave-approvals',
      '/dashboard/tickets/new',
      '/dashboard/tickets/any-id',
      '/dashboard/tickets/any-id/completed',
      '/dashboard/en-route/any-id',
      '/dashboard/work-session/any-id',
      '/dashboard/work-session/any-id/handoff'
    ];
    for (const path of auditedPaths) {
      expect(resolveRouteGuard(path), `${path} should be registered`).not.toBe('unregistered');
    }
  });

  it('registry order: dynamic-segment patterns precede their parents', () => {
    // If ordering were wrong, /dashboard/admin/payroll/records/abc/print could
    // match the parent catchall. The key invariant is that the records/print
    // entry exists and matches before the parent: assert the explicit entry
    // sits before the parent catchall.
    const recordsPrintIndex = ROUTE_REGISTRY.findIndex(
      (e) => e.pattern.source === '^\\/dashboard\\/admin\\/payroll\\/records\\/[^/]+\\/print$'
    );
    const recordsIndex = ROUTE_REGISTRY.findIndex(
      (e) => e.pattern.source === '^\\/dashboard\\/admin\\/payroll\\/records$'
    );
    const payrollIndex = ROUTE_REGISTRY.findIndex(
      (e) => e.pattern.source === '^\\/dashboard\\/admin\\/payroll$'
    );
    expect(recordsPrintIndex).toBeGreaterThanOrEqual(0);
    expect(recordsIndex).toBeGreaterThan(recordsPrintIndex);
    expect(payrollIndex).toBeGreaterThan(recordsIndex);
  });
});

import type { PermissionAction } from './session';

/**
 * The unit a route guard hands back: which module + action must be granted
 * for the user to open a given dashboard path. Mirrors the `module.action`
 * shape the permission matrix already speaks (`hasModulePermission`).
 */
export type RouteGuard = { module: string; action: PermissionAction };

/**
 * Result of resolving a pathname against the registry:
 * - `RouteGuard` — the registered module.action that protects the path.
 * - `'unregistered'` — a dashboard path that has NO registry entry; fail-closed.
 * - `null` — not a dashboard path; passthrough (this guard does not apply).
 */
export type RouteGuardResult = RouteGuard | 'unregistered';

interface RouteEntry {
  /** Anchored regex; matched against the normalised pathname. */
  pattern: RegExp;
  module: string;
  action: PermissionAction;
}

/**
 * URL → module.action registry. The single source of truth for which
 * permission protects which dashboard route. Every current dashboard route
 * is listed here; forgetting one is a fail-closed denial (with a dev-mode
 * warning) — never a silent open page.
 *
 * Pattern order matters: iterated top-to-bottom, first match wins. Deeper
 * or more specific paths (dynamic segments, edit/reports variants) MUST
 * precede any parent catchall.
 */
export const ROUTE_REGISTRY: ReadonlyArray<RouteEntry> = [
  // Bare /dashboard (index route) and /dashboard/overview — both map to the
  // overview module so the redirect-on-index path is itself permission-checked.
  { pattern: /^\/dashboard$/, module: 'overview', action: 'view' },
  { pattern: /^\/dashboard\/overview$/, module: 'overview', action: 'view' },

  // /dashboard/admin/payroll/* — specific actions for edit/reports/print,
  // broader view catchalls after.
  {
    pattern: /^\/dashboard\/admin\/payroll\/generate$/,
    module: 'payroll',
    action: 'edit'
  },
  {
    pattern: /^\/dashboard\/admin\/payroll\/settings$/,
    module: 'payroll',
    action: 'edit'
  },
  {
    pattern: /^\/dashboard\/admin\/payroll\/reports$/,
    module: 'payroll',
    action: 'reports'
  },
  {
    pattern: /^\/dashboard\/admin\/payroll\/records\/[^/]+\/print$/,
    module: 'payroll',
    action: 'view'
  },
  {
    pattern: /^\/dashboard\/admin\/payroll\/records$/,
    module: 'payroll',
    action: 'view'
  },
  {
    pattern: /^\/dashboard\/admin\/payroll\/profile$/,
    module: 'payroll',
    action: 'view'
  },
  {
    pattern: /^\/dashboard\/admin\/payroll\/periods$/,
    module: 'payroll',
    action: 'view'
  },
  {
    pattern: /^\/dashboard\/admin\/payroll\/ready-to-pay$/,
    module: 'payroll',
    action: 'view'
  },
  { pattern: /^\/dashboard\/admin\/payroll$/, module: 'payroll', action: 'view' },

  // /dashboard/admin/attendance/* — admin attendance management requires edit
  {
    pattern: /^\/dashboard\/admin\/attendance\/assignments$/,
    module: 'attendance_admin',
    action: 'edit'
  },
  {
    pattern: /^\/dashboard\/admin\/attendance\/schedules$/,
    module: 'attendance_admin',
    action: 'edit'
  },
  {
    pattern: /^\/dashboard\/admin\/attendance\/locations$/,
    module: 'attendance_admin',
    action: 'edit'
  },
  {
    pattern: /^\/dashboard\/admin\/attendance\/reports$/,
    module: 'attendance_admin',
    action: 'edit'
  },
  {
    pattern: /^\/dashboard\/admin\/attendance\/face-settings$/,
    module: 'attendance_admin',
    action: 'edit'
  },

  // /dashboard/admin/role-groups/* — list and detail (dynamic id)
  {
    pattern: /^\/dashboard\/admin\/role-groups\/[^/]+$/,
    module: 'role_groups',
    action: 'view'
  },
  { pattern: /^\/dashboard\/admin\/role-groups$/, module: 'role_groups', action: 'view' },

  // /dashboard/admin/holiday-calendar/*
  {
    pattern: /^\/dashboard\/admin\/holiday-calendar\/settings$/,
    module: 'holiday',
    action: 'view'
  },
  { pattern: /^\/dashboard\/admin\/holiday-calendar$/, module: 'holiday', action: 'view' },

  // /dashboard/admin/* (misc admin shell pages)
  { pattern: /^\/dashboard\/admin\/audit-log$/, module: 'audit_log', action: 'view' },
  { pattern: /^\/dashboard\/admin\/broadcast$/, module: 'broadcast', action: 'view' },
  { pattern: /^\/dashboard\/admin\/departments$/, module: 'departments', action: 'view' },
  { pattern: /^\/dashboard\/admin\/designations$/, module: 'designations', action: 'view' },
  { pattern: /^\/dashboard\/admin\/storage-settings$/, module: 'storage', action: 'view' },
  { pattern: /^\/dashboard\/admin\/worklog-settings$/, module: 'settings', action: 'view' },
  { pattern: /^\/dashboard\/admin\/rate-limit$/, module: 'settings', action: 'view' },

  // /dashboard/spv/* — supervisor review queue and leave approvals
  {
    pattern: /^\/dashboard\/spv\/review\/[^/]+$/,
    module: 'spv_review',
    action: 'view'
  },
  { pattern: /^\/dashboard\/spv\/review$/, module: 'spv_review', action: 'view' },
  {
    pattern: /^\/dashboard\/spv\/leave-approvals$/,
    module: 'spv_review',
    action: 'view'
  },

  // /dashboard/tickets/* — crew ticket flow (new, detail, completed)
  {
    pattern: /^\/dashboard\/tickets\/[^/]+\/completed$/,
    module: 'tickets',
    action: 'view'
  },
  { pattern: /^\/dashboard\/tickets\/[^/]+$/, module: 'tickets', action: 'view' },
  { pattern: /^\/dashboard\/tickets\/new$/, module: 'tickets', action: 'view' },

  // /dashboard/work-session/* and /dashboard/en-route/* — technician in-flight views
  {
    pattern: /^\/dashboard\/work-session\/[^/]+\/handoff$/,
    module: 'tickets',
    action: 'view'
  },
  {
    pattern: /^\/dashboard\/work-session\/[^/]+$/,
    module: 'tickets',
    action: 'view'
  },
  {
    pattern: /^\/dashboard\/en-route\/[^/]+$/,
    module: 'tickets',
    action: 'view'
  },

  // /dashboard/payroll/payslips — currently payroll.view; ticket 04 moves this
  // to the new `payslips.view` module.
  { pattern: /^\/dashboard\/payroll\/payslips$/, module: 'payroll', action: 'view' },

  // /dashboard/attendance/* — technician/employee check-in flow
  {
    pattern: /^\/dashboard\/attendance\/check-in$/,
    module: 'attendance',
    action: 'view'
  },
  {
    pattern: /^\/dashboard\/attendance\/face-settings$/,
    module: 'attendance',
    action: 'view'
  },
  { pattern: /^\/dashboard\/attendance$/, module: 'attendance', action: 'view' },

  // Personal pages
  { pattern: /^\/dashboard\/leave$/, module: 'leave', action: 'view' },
  { pattern: /^\/dashboard\/schedule$/, module: 'schedule', action: 'view' },
  { pattern: /^\/dashboard\/achievements$/, module: 'achievements', action: 'view' },
  { pattern: /^\/dashboard\/daily-checklist$/, module: 'checklist', action: 'view' },
  { pattern: /^\/dashboard\/my-work$/, module: 'my_work', action: 'view' },
  { pattern: /^\/dashboard\/jobs$/, module: 'jobs', action: 'view' },
  { pattern: /^\/dashboard\/settings$/, module: 'settings', action: 'view' },
  { pattern: /^\/dashboard\/profile$/, module: 'profile', action: 'view' },
  { pattern: /^\/dashboard\/edit-profile$/, module: 'profile', action: 'view' },
  { pattern: /^\/dashboard\/change-password$/, module: 'profile', action: 'view' },
  { pattern: /^\/dashboard\/notifications$/, module: 'notifications', action: 'view' },
  { pattern: /^\/dashboard\/employees$/, module: 'employees', action: 'view' },
  { pattern: /^\/dashboard\/customers$/, module: 'customers', action: 'view' },
  { pattern: /^\/dashboard\/users$/, module: 'users', action: 'view' }
];

/**
 * Pure resolver seam. Maps a pathname to the module.action that protects it,
 * `'unregistered'` for dashboard paths with no entry (fail-closed), or `null`
 * for non-dashboard paths (this guard does not apply).
 *
 * Trailing slashes are normalised before matching so `/dashboard/employees`
 * and `/dashboard/employees/` resolve identically. Patterns are matched in
 * declaration order; the first hit wins.
 */
export function resolveRouteGuard(pathname: string): RouteGuardResult | null {
  const normalized = pathname.replace(/\/+$/, '');
  // Treat the path as a dashboard path only when it is exactly `/dashboard`
  // or continues with a `/` (so lookalikes like `/dashboards` or
  // `/dashboardx` fall through to passthrough).
  const isDashboard = normalized === '/dashboard' || normalized.startsWith('/dashboard/');
  if (!isDashboard) return null;
  for (const entry of ROUTE_REGISTRY) {
    if (entry.pattern.test(normalized)) {
      return { module: entry.module, action: entry.action };
    }
  }
  return 'unregistered';
}

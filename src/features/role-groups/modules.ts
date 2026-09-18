import type { PermissionAction } from '@/lib/auth/session';

const MODULES = [
  { key: 'overview', label: 'Dashboard', actions: ['view'] },
  { key: 'my_work', label: 'My Work', actions: ['view'] },
  { key: 'customers', label: 'Customers', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'employees', label: 'Employees', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'attendance', label: 'Attendance', actions: ['view'] },
  {
    key: 'attendance_admin',
    label: 'Attendance Management',
    actions: ['view', 'add', 'edit', 'delete', 'reports']
  },
  { key: 'checklist', label: 'Daily Checklist', actions: ['view', 'edit', 'approve'] },
  { key: 'schedule', label: 'Schedule', actions: ['view'] },
  { key: 'achievements', label: 'Achievements', actions: ['view'] },
  { key: 'leave', label: 'Leave', actions: ['view'] },
  { key: 'users', label: 'Users', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'departments', label: 'Departments', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'designations', label: 'Job Titles', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'audit_log', label: 'Audit Log', actions: ['view'] },
  { key: 'role_groups', label: 'Role Groups', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'notifications', label: 'Notifications', actions: ['view'] },
  { key: 'broadcast', label: 'Broadcast', actions: ['view'] },
  { key: 'holiday', label: 'Holiday Calendar', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'storage', label: 'Storage', actions: ['view', 'edit'] },
  { key: 'settings', label: 'Settings', actions: ['view', 'edit'] },
  { key: 'profile', label: 'Profile', actions: ['view'] },
  { key: 'jobs', label: 'Jobs', actions: ['view'] },
  {
    key: 'payroll',
    label: 'Payroll',
    actions: ['view', 'add', 'edit', 'delete', 'approve', 'pay', 'reports']
  },
  {
    key: 'payslips',
    label: 'My Payslips',
    actions: ['view']
  },
  {
    key: 'tickets',
    label: 'Tickets',
    actions: ['view', 'add', 'edit']
  },
  {
    key: 'spv_review',
    label: 'SPV Review',
    actions: ['view', 'edit']
  }
] as const;

// Canonical column order for the matrix. Kept stable (and matching the
// `PermissionAction` union) instead of raw first-seen order, so adding an
// action to an early module (e.g. `reports` on `attendance_admin`) never
// reshuffles the columns for every other row.
const ACTION_ORDER: readonly PermissionAction[] = [
  'view',
  'add',
  'edit',
  'delete',
  'approve',
  'pay',
  'reports'
];

export const PERMISSION_ACTIONS: readonly PermissionAction[] = ACTION_ORDER.filter((action) =>
  MODULES.some((module) => (module.actions as readonly string[]).includes(action))
);

export { MODULES };

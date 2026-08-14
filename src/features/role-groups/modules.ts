const MODULES = [
  { key: 'overview', label: 'Dashboard', actions: ['view'] },
  { key: 'my_work', label: 'My Work', actions: ['view'] },
  { key: 'customers', label: 'Customers', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'employees', label: 'Employees', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'attendance', label: 'Attendance', actions: ['view'] },
  { key: 'leave', label: 'Leave', actions: ['view'] },
  { key: 'users', label: 'Users', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'departments', label: 'Departments', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'designations', label: 'Job Titles', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'audit_log', label: 'Audit Log', actions: ['view'] },
  { key: 'role_groups', label: 'Role Groups', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'notifications', label: 'Notifications', actions: ['view'] },
  { key: 'holiday', label: 'Holiday Calendar', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'storage', label: 'Storage', actions: ['view', 'edit'] },
  { key: 'profile', label: 'Profile', actions: ['view'] },
  { key: 'jobs', label: 'Jobs', actions: ['view'] },
  {
    key: 'payroll',
    label: 'Payroll',
    actions: ['view', 'add', 'edit', 'delete', 'approve', 'pay', 'reports']
  },
  {
    key: 'tickets',
    label: 'Tickets',
    actions: ['view', 'add', 'edit']
  }
] as const;

type ModuleKey = (typeof MODULES)[number]['key'];

export { MODULES };
export type { ModuleKey };

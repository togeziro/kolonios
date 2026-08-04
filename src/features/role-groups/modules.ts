const MODULES = [
  { key: 'overview', label: 'Dashboard', hasCrud: false },
  { key: 'my_work', label: 'My Work', hasCrud: false },
  { key: 'customers', label: 'Customers', hasCrud: true },
  { key: 'employees', label: 'Employees', hasCrud: true },
  { key: 'attendance', label: 'Attendance', hasCrud: false },
  { key: 'leave', label: 'Leave', hasCrud: false },
  { key: 'users', label: 'Users', hasCrud: true },
  { key: 'departments', label: 'Departments', hasCrud: true },
  { key: 'designations', label: 'Job Titles', hasCrud: true },
  { key: 'audit_log', label: 'Audit Log', hasCrud: false },
  { key: 'role_groups', label: 'Role Groups', hasCrud: true },
  { key: 'notifications', label: 'Notifications', hasCrud: false },
  { key: 'profile', label: 'Profile', hasCrud: false },
  { key: 'jobs', label: 'Jobs', hasCrud: false },
  { key: 'payroll', label: 'Payroll', hasCrud: true }
] as const;

type ModuleKey = (typeof MODULES)[number]['key'];

export { MODULES };
export type { ModuleKey };

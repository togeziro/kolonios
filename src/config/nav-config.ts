import { NavItem } from '@/types';

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    module: 'overview',
    items: []
  },
  {
    title: 'Employees',
    url: '/dashboard/employees',
    icon: 'employee',
    isActive: false,
    shortcut: ['e', 'e'],
    module: 'employees',
    items: []
  },
  {
    title: 'Customers',
    url: '/dashboard/customers',
    icon: 'customer',
    isActive: false,
    shortcut: ['c', 'c'],
    module: 'customers',
    items: []
  },
  {
    title: 'Tickets',
    url: '/dashboard/tickets/new',
    icon: 'workspace',
    isActive: false,
    module: 'tickets',
    items: [
      {
        title: 'Available Jobs',
        url: '/dashboard/jobs',
        icon: 'business',
        isActive: false,
        module: 'jobs',
        items: []
      },
      {
        title: 'New Ticket',
        url: '/dashboard/tickets/new',
        icon: 'workspace',
        isActive: false,
        module: 'tickets',
        items: []
      }
    ]
  },
  {
    title: 'My Work',
    url: '/dashboard/my-work',
    icon: 'workspace',
    isActive: false,
    module: 'my_work',
    hiddenForAdmin: true,
    items: []
  },
  {
    title: 'Attendance',
    url: '/dashboard/attendance',
    icon: 'clock',
    isActive: false,
    shortcut: ['a', 'a'],
    module: 'attendance',
    hiddenForAdmin: true,
    items: []
  },
  {
    title: 'Leave',
    url: '/dashboard/leave',
    icon: 'calendar',
    isActive: false,
    shortcut: ['l', 'l'],
    module: 'leave',
    items: []
  },
  {
    title: 'Payroll',
    url: '/dashboard/admin/payroll',
    icon: 'wallet',
    isActive: false,
    module: 'payroll',
    items: [
      {
        title: 'Payroll',
        url: '/dashboard/admin/payroll',
        icon: 'wallet',
        isActive: false,
        module: 'payroll',
        items: []
      },
      {
        title: 'Payroll Profiles',
        url: '/dashboard/admin/payroll/profile',
        icon: 'employee',
        isActive: false,
        module: 'payroll',
        items: []
      },
      {
        title: 'Payroll Settings',
        url: '/dashboard/admin/payroll/settings',
        icon: 'wallet',
        isActive: false,
        module: 'payroll',
        items: []
      }
    ]
  },
  {
    title: 'Payslips',
    url: '/dashboard/payroll/payslips',
    icon: 'wallet',
    isActive: false,
    module: 'payroll',
    hiddenForAdmin: true,
    items: []
  },
  {
    title: 'Broadcast',
    url: '/dashboard/admin/broadcast',
    icon: 'send',
    isActive: false,
    module: 'broadcast',
    items: []
  },
  {
    title: 'Attendance Management',
    url: '/dashboard/admin/attendance/locations',
    icon: 'clock',
    isActive: false,
    module: 'attendance_admin',
    items: [
      {
        title: 'Attendance Locations',
        url: '/dashboard/admin/attendance/locations',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        items: []
      },
      {
        title: 'Attendance Schedules',
        url: '/dashboard/admin/attendance/schedules',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        items: []
      },
      {
        title: 'Attendance Assignments',
        url: '/dashboard/admin/attendance/assignments',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        items: []
      },
      {
        title: 'Attendance Reports',
        url: '/dashboard/admin/attendance/reports',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        items: []
      }
    ]
  },
  {
    title: 'Holiday Calendar',
    url: '/dashboard/admin/holiday-calendar',
    icon: 'calendar',
    isActive: false,
    module: 'holiday',
    items: [
      {
        title: 'Holiday Calendar',
        url: '/dashboard/admin/holiday-calendar',
        icon: 'calendar',
        isActive: false,
        module: 'holiday',
        items: []
      },
      {
        title: 'Holiday Settings',
        url: '/dashboard/admin/holiday-calendar/settings',
        icon: 'settings',
        isActive: false,
        module: 'holiday',
        items: []
      }
    ]
  },
  {
    title: 'Settings',
    url: '/dashboard/users',
    icon: 'settings',
    isActive: false,
    module: 'users',
    items: [
      {
        title: 'Users',
        url: '/dashboard/users',
        icon: 'teams',
        shortcut: ['u', 'u'],
        isActive: false,
        module: 'users',
        items: []
      },
      {
        title: 'Departments',
        url: '/dashboard/admin/departments',
        icon: 'workspace',
        shortcut: ['d', 'e'],
        isActive: false,
        module: 'departments',
        items: []
      },
      {
        title: 'Job Titles',
        url: '/dashboard/admin/designations',
        icon: 'employee',
        shortcut: ['j', 't'],
        isActive: false,
        module: 'designations',
        items: []
      },
      {
        title: 'Audit Log',
        url: '/dashboard/admin/audit-log',
        icon: 'clock',
        isActive: false,
        module: 'audit_log',
        items: []
      },
      {
        title: 'Role Groups',
        url: '/dashboard/admin/role-groups',
        icon: 'workspace',
        isActive: false,
        module: 'role_groups',
        items: []
      }
    ]
  },
  {
    title: 'Profile',
    url: '/dashboard/profile',
    icon: 'profile',
    isActive: false,
    module: 'profile',
    hiddenForAdmin: true,
    items: []
  }
];

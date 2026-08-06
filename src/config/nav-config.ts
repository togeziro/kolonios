import { NavGroup } from '@/types';

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
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
        title: 'My Work',
        url: '/dashboard/my-work',
        icon: 'workspace',
        isActive: false,
        module: 'my_work',
        items: []
      },
      {
        title: 'Attendance',
        url: '/dashboard/attendance',
        icon: 'clock',
        shortcut: ['a', 'a'],
        isActive: false,
        module: 'attendance',
        items: []
      },
      {
        title: 'Leave',
        url: '/dashboard/leave',
        icon: 'calendar',
        shortcut: ['l', 'l'],
        isActive: false,
        module: 'leave',
        items: []
      },
      {
        title: 'Profile',
        url: '/dashboard/profile',
        icon: 'profile',
        isActive: false,
        module: 'profile',
        items: []
      },
      {
        title: 'Payslips',
        url: '/dashboard/payroll/payslips',
        icon: 'wallet',
        isActive: false,
        module: 'payroll',
        items: []
      }
    ]
  },
  {
    label: 'Management',
    items: [
      {
        title: 'Customers',
        url: '/dashboard/customers',
        icon: 'customer',
        shortcut: ['c', 'c'],
        isActive: false,
        module: 'customers',
        items: []
      },
      {
        title: 'Employees',
        url: '/dashboard/employees',
        icon: 'employee',
        shortcut: ['e', 'e'],
        isActive: false,
        module: 'employees',
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
      }
    ]
  },
  {
    label: 'Settings',
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
      },
      {
        title: 'Holiday Calendar',
        url: '/dashboard/admin/holiday-calendar',
        icon: 'calendar',
        isActive: false,
        module: 'holiday_calendar',
        items: [
          {
            title: 'Holiday Calendar',
            url: '/dashboard/admin/holiday-calendar',
            icon: 'calendar',
            isActive: false,
            module: 'holiday_calendar',
            items: []
          },
          {
            title: 'Holiday Settings',
            url: '/dashboard/admin/holiday-calendar/settings',
            icon: 'settings',
            isActive: false,
            module: 'holiday_calendar',
            items: []
          }
        ]
      }
    ]
  }
];

import { NavItem } from '@/types';

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    module: 'overview',
    items: []
  },
  {
    title: 'Employees',
    url: '/dashboard/employees',
    icon: 'employee',
    isActive: false,
    module: 'employees',
    items: []
  },
  {
    title: 'Customers',
    url: '/dashboard/customers',
    icon: 'customer',
    isActive: false,
    module: 'customers',
    items: []
  },
  {
    title: 'Tickets',
    url: '/dashboard/tickets',
    icon: 'workspace',
    isActive: false,
    module: 'tickets',
    items: [
      {
        title: 'All Tickets',
        url: '/dashboard/tickets',
        icon: 'workspace',
        isActive: false,
        module: 'tickets',
        items: []
      },
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
    url: '/dashboard/attendance/check-in',
    icon: 'clock',
    isActive: false,
    module: 'attendance',
    hiddenForAdmin: true,
    items: []
  },
  {
    title: 'Schedule',
    url: '/dashboard/schedule',
    icon: 'calendar',
    isActive: false,
    module: 'schedule',
    hiddenForAdmin: true,
    items: []
  },
  {
    title: 'Leave',
    url: '/dashboard/leave',
    icon: 'calendar',
    isActive: false,
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
        title: 'Ready to Pay',
        url: '/dashboard/admin/payroll/ready-to-pay',
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
    title: 'Attendance Admin',
    url: '/dashboard/admin/attendance/locations',
    icon: 'clock',
    isActive: false,
    module: 'attendance_admin',
    items: [
      {
        title: 'Locations',
        url: '/dashboard/admin/attendance/locations',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        items: []
      },
      {
        title: 'Schedules',
        url: '/dashboard/admin/attendance/schedules',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        items: []
      },
      {
        title: 'Schedule Grid',
        url: '/dashboard/admin/attendance/schedule-grid',
        icon: 'calendar',
        isActive: false,
        module: 'attendance_admin',
        items: []
      },
      {
        title: 'Assignments',
        url: '/dashboard/admin/attendance/assignments',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        items: []
      },
      {
        title: 'Reports',
        url: '/dashboard/admin/attendance/reports',
        icon: 'clock',
        isActive: false,
        module: 'attendance_admin',
        requiredAction: 'reports',
        items: []
      },
      {
        title: 'Face Settings',
        url: '/dashboard/admin/attendance/face-settings',
        icon: 'settings',
        isActive: false,
        module: 'settings',
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
        isActive: false,
        module: 'users',
        items: []
      },
      {
        title: 'Departments',
        url: '/dashboard/admin/departments',
        icon: 'workspace',
        isActive: false,
        module: 'departments',
        items: []
      },
      {
        title: 'Job Titles',
        url: '/dashboard/admin/designations',
        icon: 'employee',
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
        title: 'Storage Settings',
        url: '/dashboard/admin/storage-settings',
        icon: 'settings',
        isActive: false,
        module: 'storage',
        items: []
      },
      {
        title: 'Work Log Settings',
        url: '/dashboard/admin/worklog-settings',
        icon: 'settings',
        isActive: false,
        module: 'settings',
        items: []
      },
      {
        title: 'Rate Limit Settings',
        url: '/dashboard/admin/rate-limit',
        icon: 'shield',
        isActive: false,
        module: 'settings',
        items: []
      },
      {
        title: 'Branding',
        url: '/dashboard/settings',
        icon: 'settings',
        isActive: false,
        module: 'settings',
        items: []
      }
    ]
  },
  {
    title: 'Review Queue',
    url: '/dashboard/spv/review',
    icon: 'workspace',
    isActive: false,
    module: 'checklist',
    requiredAction: 'approve',
    items: []
  },
  {
    title: 'Leave Approvals',
    url: '/dashboard/spv/leave-approvals',
    icon: 'calendar',
    isActive: false,
    module: 'spv_review',
    items: []
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

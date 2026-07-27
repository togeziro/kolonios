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
        items: []
      },
      {
        title: 'Product',
        url: '/dashboard/product',
        icon: 'product',
        shortcut: ['p', 'p'],
        isActive: false,
        items: []
      },
      {
        title: 'Customers',
        url: '/dashboard/customers',
        icon: 'customer',
        shortcut: ['c', 'c'],
        isActive: false,
        items: []
      },
      {
        title: 'Employees',
        url: '/dashboard/employees',
        icon: 'employee',
        shortcut: ['e', 'e'],
        isActive: false,
        items: []
      },
      {
        title: 'Attendance',
        url: '/dashboard/attendance',
        icon: 'clock',
        shortcut: ['a', 'a'],
        isActive: false,
        items: []
      },
      {
        title: 'Leave',
        url: '/dashboard/leave',
        icon: 'calendar',
        shortcut: ['l', 'l'],
        isActive: false,
        items: []
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
        items: []
      },
      {
        title: 'Departments',
        url: '/dashboard/admin/departments',
        icon: 'workspace',
        shortcut: ['d', 'e'],
        isActive: false,
        items: []
      },
      {
        title: 'Job Titles',
        url: '/dashboard/admin/designations',
        icon: 'employee',
        shortcut: ['j', 't'],
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: 'Elements',
    items: [
      {
        title: 'Forms',
        url: '#',
        icon: 'forms',
        isActive: true,
        items: [
          {
            title: 'Basic Form',
            url: '/dashboard/forms/basic',
            icon: 'forms',
            shortcut: ['f', 'f']
          },
          {
            title: 'Multi-Step Form',
            url: '/dashboard/forms/multi-step',
            icon: 'forms'
          },
          {
            title: 'Sheet & Dialog',
            url: '/dashboard/forms/sheet-form',
            icon: 'forms'
          },
          {
            title: 'Advanced Patterns',
            url: '/dashboard/forms/advanced',
            icon: 'forms'
          }
        ]
      },
      {
        title: 'React Query',
        url: '/dashboard/react-query',
        icon: 'code',
        isActive: false,
        items: []
      },
      {
        title: 'Icons',
        url: '/dashboard/elements/icons',
        icon: 'palette',
        isActive: false,
        items: []
      }
    ]
  }
];

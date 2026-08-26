import { useTranslation } from 'react-i18next';
import { useLocation } from '@tanstack/react-router';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

export const breadcrumbSegmentKeys: Record<string, string> = {
  dashboard: 'navigation.dashboard',
  overview: 'navigation.overview',
  customers: 'navigation.customers',
  employees: 'navigation.employees',
  users: 'navigation.users',
  attendance: 'navigation.attendance',
  leave: 'navigation.leave',
  profile: 'navigation.profile',
  admin: 'navigation.settings',
  departments: 'navigation.departments',
  designations: 'navigation.jobTitles',
  'audit-log': 'navigation.auditLog',
  'role-groups': 'navigation.roleGroups',
  'holiday-calendar': 'navigation.holidayCalendar',
  payroll: 'navigation.payroll',
  records: 'payroll.records',
  generate: 'payroll.generate',
  periods: 'payroll.periods',
  reports: 'payroll.reports',
  settings: 'navigation.settings'
};

// This allows to add custom title as well
const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: 'navigation.dashboard', link: '/dashboard' }],
  '/dashboard/employee': [
    { title: 'navigation.dashboard', link: '/dashboard' },
    { title: 'employee.title', link: '/dashboard/employee' }
  ],
  '/dashboard/admin/payroll/profile': [
    { title: 'navigation.dashboard', link: '/dashboard' },
    { title: 'navigation.payroll', link: '/dashboard/admin/payroll' },
    { title: 'payroll.profile', link: '/dashboard/admin/payroll/profile' }
  ],
  '/dashboard/admin/payroll/ready-to-pay': [
    { title: 'navigation.dashboard', link: '/dashboard' },
    { title: 'navigation.payroll', link: '/dashboard/admin/payroll' },
    { title: 'payroll.payQueue.title', link: '/dashboard/admin/payroll/ready-to-pay' }
  ]
  // Add more custom mappings as needed
};

export function computeBreadcrumbs(pathname: string, t: (key: string) => string): BreadcrumbItem[] {
  if (routeMapping[pathname]) {
    const items = routeMapping[pathname].map((item) => ({ ...item, title: t(item.title) }));
    return items.filter((item, index) => index === 0 || item.title !== items[index - 1].title);
  }

  const segments = pathname.split('/').filter(Boolean);
  const items = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`;
    const key = breadcrumbSegmentKeys[segment];
    return {
      segment,
      title: key ? t(key) : segment.charAt(0).toUpperCase() + segment.slice(1),
      link: path
    };
  });

  return items
    .filter((item) => item.segment !== 'admin')
    .map(({ segment: _segment, ...rest }) => rest)
    .filter((item, index, arr) => index === 0 || item.title !== arr[index - 1].title);
}

export function useBreadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const breadcrumbs = useMemo(() => computeBreadcrumbs(pathname, t), [pathname, t]);

  return breadcrumbs;
}

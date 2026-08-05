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
  ]
  // Add more custom mappings as needed
};

export function useBreadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const breadcrumbs = useMemo(() => {
    // Check if we have a custom mapping for this exact path
    if (routeMapping[pathname]) {
      return routeMapping[pathname].map((item) => ({ ...item, title: t(item.title) }));
    }

    // If no exact match, fall back to generating breadcrumbs from the path
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      const key = breadcrumbSegmentKeys[segment];
      return {
        title: key ? t(key) : segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname, t]);

  return breadcrumbs;
}

import { Link, useLocation } from '@tanstack/react-router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Icons } from '@/components/icons';
import { useTranslation } from 'react-i18next';
import type { Permissions } from '@/features/role-groups/api/types';
import { useRoleGroupPermissions } from '@/hooks/use-nav';

const navItems = [
  {
    icon: Icons.dashboard,
    labelKey: 'navigation.home',
    to: '/dashboard/overview',
    module: undefined
  },
  {
    icon: Icons.workspace,
    labelKey: 'navigation.myWork',
    to: '/dashboard/my-work',
    module: undefined
  },
  { icon: Icons.calendar, labelKey: 'navigation.leave', to: '/dashboard/leave', module: undefined },
  {
    icon: Icons.billing,
    labelKey: 'navigation.payslips',
    to: '/dashboard/payroll/payslips',
    module: 'payroll'
  },
  { icon: Icons.user, labelKey: 'navigation.profile', to: '/dashboard/profile', module: undefined }
] as const;

export function filterBottomNavItems(
  items: typeof navItems,
  permissions?: Permissions,
  isAdmin = false
) {
  return items.filter(
    (item) => item.module !== 'payroll' || isAdmin || permissions?.payroll?.view === true
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const visibleNavItems = filterBottomNavItems(navItems, permissions, isAdmin);

  return (
    <motion.nav
      initial={{ y: 60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className='bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-lg'
    >
      <Link
        to='/dashboard/attendance'
        aria-label={t('navigation.goToAttendance')}
        className='bg-primary text-primary-foreground absolute -top-6 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full shadow-lg'
      >
        {reduceMotion ? (
          <Icons.clock className='h-5 w-5' />
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
            >
              <Icons.clock className='h-5 w-5' />
            </motion.div>
          </AnimatePresence>
        )}
      </Link>

      <div className='mx-auto flex max-w-lg items-center justify-around py-2'>
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
          return (
            <Link
              key={item.to}
              to={item.to}
              className='flex touch-manipulation flex-col items-center gap-0.5 px-3 py-1'
            >
              <item.icon
                className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span
                className={`text-[10px] ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}

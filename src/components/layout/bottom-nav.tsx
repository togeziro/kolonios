import { Link, useLocation } from '@tanstack/react-router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Icons } from '@/components/icons';
import { useTranslation } from 'react-i18next';

export const navItems = [
  {
    icon: Icons.dashboard,
    labelKey: 'navigation.home',
    to: '/dashboard/overview'
  },
  {
    icon: Icons.workspace,
    labelKey: 'navigation.myWork',
    to: '/dashboard/my-work'
  },
  {
    icon: Icons.business,
    labelKey: 'navigation.office',
    to: '/dashboard/jobs'
  },
  { icon: Icons.user, labelKey: 'navigation.profile', to: '/dashboard/profile' }
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const isActive = (item: (typeof navItems)[number]) =>
    pathname === item.to || pathname.startsWith(item.to + '/');

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
        className='bg-primary text-primary-foreground absolute -top-6 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-2xl shadow-lg'
      >
        {reduceMotion ? (
          <Icons.qr className='h-5 w-5' />
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
            >
              <Icons.qr className='h-5 w-5' />
            </motion.div>
          </AnimatePresence>
        )}
      </Link>

      <div className='mx-auto grid max-w-[430px] grid-cols-4 py-2'>
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className='flex touch-manipulation flex-col items-center gap-0.5 px-3 py-1'
          >
            <item.icon
              className={`h-5 w-5 ${isActive(item) ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span
              className={`text-[10px] ${
                isActive(item) ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}
            >
              {t(item.labelKey)}
            </span>
          </Link>
        ))}
      </div>
    </motion.nav>
  );
}

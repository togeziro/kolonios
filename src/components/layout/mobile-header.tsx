import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from '@tanstack/react-router';
import { useSession, signOut } from '@/lib/auth/auth-client';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';

interface MobileHeaderProps {
  dark: boolean;
  onToggleDark: () => void;
}

export function MobileHeader({ dark, onToggleDark }: MobileHeaderProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const user = session?.user;
  const name = user?.name ?? 'User';
  const email = user?.email ?? '';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const hour = new Date().getHours();
  let greeting = t('navigation.goodEvening');
  if (hour < 12) greeting = t('navigation.goodMorning');
  else if (hour < 18) greeting = t('navigation.goodAfternoon');

  async function handleLogout() {
    setOpen(false);
    await signOut();
    router.navigate({ to: '/' });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className='sticky top-0 z-20 flex items-center justify-between px-4 pt-4 pb-2'
    >
      <div ref={ref} className='relative'>
        <button
          aria-label={t('navigation.openUserMenu')}
          onClick={() => setOpen((o) => !o)}
          className='flex items-center gap-3'
        >
          <Avatar className='h-10 w-10 border dark:border-zinc-700/50 dark:bg-zinc-800'>
            <AvatarFallback className='bg-zinc-800 text-xs font-bold text-zinc-400 dark:bg-zinc-800'>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className='text-left'>
            <p className='text-muted-foreground text-xs'>{greeting}</p>
            <p className='text-sm font-semibold leading-tight'>{name}</p>
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className='bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 w-52 rounded-lg border shadow-lg'
            >
              <div className='px-3 py-2'>
                <p className='text-sm font-medium'>{name}</p>
                <p className='text-muted-foreground truncate text-xs'>{email}</p>
              </div>
              <hr />
              <button
                onClick={handleLogout}
                className='hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-sm'
              >
                <Icons.logout className='h-4 w-4' />
                {t('common.signOut')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className='flex items-center justify-end'>
        <button
          aria-label={t('navigation.toggleTheme')}
          onClick={onToggleDark}
          className='bg-muted mr-2 flex h-10 w-10 items-center justify-center rounded-xl text-foreground dark:bg-zinc-800/50 dark:text-white'
        >
          {dark ? <Icons.sun className='h-5 w-5' /> : <Icons.moon className='h-5 w-5' />}
        </button>
        <div className='relative'>
          <button
            aria-label={t('navigation.notifications')}
            className='bg-muted flex h-10 w-10 items-center justify-center rounded-xl text-foreground dark:bg-zinc-800/50 dark:text-white'
          >
            <Icons.notification className='h-5 w-5' />
          </button>
          <span className='bg-destructive absolute top-2.5 right-2.5 flex h-2 w-2 rounded-full border border-background' />
        </div>
      </div>
    </motion.div>
  );
}

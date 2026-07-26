import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from '@tanstack/react-router';
import { useSession, signOut } from '@/lib/auth/auth-client';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function MobileHeader() {
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
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

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
      className='relative flex items-center justify-between px-4 pt-4 pb-2'
    >
      <div ref={ref} className='relative'>
        <button onClick={() => setOpen((o) => !o)} className='flex items-center gap-3'>
          <Avatar className='h-10 w-10 border'>
            <AvatarFallback className='bg-primary/10 text-primary text-xs font-medium'>
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
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className='relative'>
        <Icons.notification className='h-5 w-5 text-muted-foreground' />
        <span className='bg-destructive absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full text-[8px] text-white' />
      </div>
    </motion.div>
  );
}

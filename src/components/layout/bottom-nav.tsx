import { useLocation, useRouter } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { myAttendanceQueryOptions } from '@/features/attendance/api/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkInFn } from '@/features/attendance/api/service';

const navItems = [
  { icon: Icons.dashboard, label: 'Home', to: '/dashboard/overview' },
  { icon: Icons.clock, label: 'Attendance', to: '/dashboard/attendance' },
  { icon: Icons.calendar, label: 'Leave', to: '/dashboard/leave' },
  { icon: Icons.user, label: 'Profile', to: '/dashboard/notifications' }
];

export function BottomNav() {
  const { pathname } = useLocation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const record = todayData?.attendance?.attendance;
  const isCheckedIn = !!record?.check_in_time;
  const isCheckedOut = !!record?.check_out_time;

  const checkInMutation = useMutation({
    mutationFn: () => checkInFn({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  });

  const showFAB = !isCheckedOut;

  return (
    <motion.nav
      initial={{ y: 60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className='bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-lg'
    >
      {showFAB && (
        <AnimatePresence>
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending || isCheckedOut}
            className='bg-primary text-primary-foreground absolute -top-6 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full shadow-lg'
          >
            {checkInMutation.isPending ? (
              <Icons.spinner className='h-5 w-5 animate-spin' />
            ) : isCheckedIn ? (
              <Icons.check className='h-5 w-5' />
            ) : (
              <Icons.login className='h-5 w-5' />
            )}
          </motion.button>
        </AnimatePresence>
      )}

      <div className='mx-auto flex max-w-lg items-center justify-around py-2'>
        {navItems.map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
          return (
            <button
              key={item.to}
              onClick={() => router.navigate({ to: item.to })}
              className='flex flex-col items-center gap-0.5 px-3 py-1'
            >
              <item.icon
                className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span
                className={`text-[10px] ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { myAttendanceQueryOptions } from '../api/queries';
import { checkInFn, checkOutFn } from '../api/service';

export default function MobileAttendanceSummary() {
  const queryClient = useQueryClient();

  const { data: todayData } = useQuery(myAttendanceQueryOptions());

  const attendance = todayData?.attendance;
  const record = attendance?.attendance;
  const isCheckedIn = !!record?.check_in_time;
  const isCheckedOut = !!record?.check_out_time;
  const status = record?.attendance_status ?? 'pending';

  const _checkInMutation = useMutation({
    mutationFn: () => checkInFn({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  });

  const checkInOutMutation = useMutation({
    mutationFn: () =>
      isCheckedIn ? checkOutFn({ data: { attendanceId: record!.id } }) : checkInFn({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  });

  const now = new Date();
  const today = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className='px-4'
    >
      <Card className='relative overflow-hidden rounded-2xl p-5'>
        <div className='flex items-start justify-between'>
          <div className='flex-1 space-y-3'>
            <div>
              <p className='text-muted-foreground text-xs'>{today}</p>
              <p className='mt-0.5 text-sm font-semibold leading-tight'>
                {isCheckedIn ? `Checked in at ${record!.check_in_time}` : 'Not yet checked in'}
              </p>
            </div>

            {!isCheckedOut && (
              <Button
                size='lg'
                className='h-10 rounded-xl px-6 text-sm font-semibold'
                onClick={() => checkInOutMutation.mutate()}
                disabled={checkInOutMutation.isPending}
              >
                {checkInOutMutation.isPending ? (
                  <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                ) : isCheckedIn ? (
                  <Icons.logout className='mr-2 h-4 w-4' />
                ) : (
                  <Icons.login className='mr-2 h-4 w-4' />
                )}
                {isCheckedIn ? 'Check Out' : 'Check In'}
              </Button>
            )}
          </div>

          <div className='flex flex-col items-center gap-1'>
            <div className='relative flex h-16 w-16 items-center justify-center'>
              <svg className='absolute inset-0 h-full w-full -rotate-90' viewBox='0 0 64 64'>
                <circle
                  cx='32'
                  cy='32'
                  r='28'
                  fill='none'
                  stroke='hsl(var(--muted))'
                  strokeWidth='4'
                />
                <motion.circle
                  cx='32'
                  cy='32'
                  r='28'
                  fill='none'
                  stroke='hsl(var(--primary))'
                  strokeWidth='4'
                  strokeLinecap='round'
                  strokeDasharray='176'
                  initial={{ strokeDashoffset: 176 }}
                  animate={{
                    strokeDashoffset: isCheckedIn ? 0 : 176
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <span className='text-xs font-bold'>{isCheckedIn ? '100' : '0'}%</span>
            </div>
            {status !== 'pending' && (
              <Badge
                variant={status === 'present' ? 'default' : 'secondary'}
                className='h-5 rounded-full px-2 text-[10px]'
              >
                {status}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

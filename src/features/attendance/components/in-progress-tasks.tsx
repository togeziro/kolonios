import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { myLeavesQueryOptions } from '../api/queries';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function InProgressTasks() {
  const { data: leavesData } = useQuery(
    myLeavesQueryOptions({ page: 1, limit: 5, status: 'pending' })
  );

  const pendingLeaves = leavesData?.leaves ?? [];
  const hasItems = pendingLeaves.length > 0;

  const items = [
    ...(hasItems
      ? pendingLeaves.map((l) => ({
          id: `leave-${l.id}`,
          label: l.leave_type,
          title: `Leave request ${l.status}`,
          date: `${l.start_date} - ${l.end_date}`,
          progress: 50,
          color: 'bg-yellow-500'
        }))
      : []),
    {
      id: 'check-in',
      label: 'Today',
      title: 'Check-in pending',
      date: new Date().toLocaleDateString(),
      progress: 0,
      color: 'bg-blue-500'
    }
  ];

  return (
    <div className='px-4'>
      <div className='mb-3 flex items-center gap-2'>
        <h2 className='text-sm font-semibold'>In Progress</h2>
        <span className='bg-muted text-muted-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium'>
          {items.length}
        </span>
      </div>

      <ScrollArea className='w-full pb-2'>
        <div className='flex gap-3'>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
            >
              <Card className='w-44 shrink-0 rounded-xl p-3.5'>
                <div className='mb-1.5 flex items-center gap-1.5'>
                  <Icons.clock className='text-muted-foreground h-3 w-3' />
                  <span className='text-muted-foreground text-[10px] font-medium uppercase'>
                    {item.label}
                  </span>
                </div>
                <p className='mb-0.5 text-sm font-semibold leading-tight'>{item.title}</p>
                <p className='text-muted-foreground mb-3 text-[10px]'>{item.date}</p>
                <div className='bg-muted h-1.5 w-full overflow-hidden rounded-full'>
                  <motion.div
                    className={`h-full rounded-full ${item.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.progress}%` }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
                  />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
        <ScrollBar orientation='horizontal' className='invisible' />
      </ScrollArea>
    </div>
  );
}

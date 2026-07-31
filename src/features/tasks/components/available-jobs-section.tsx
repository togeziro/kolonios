import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useTakeTask } from '../api/hooks';
import { availableTasksQueryOptions } from '../api/queries';
import TaskCard from './task-card';
import NotAvailableSection from './not-available-section';

export default function AvailableJobsSection() {
  const { data } = useQuery(availableTasksQueryOptions());
  const tasks = data?.tasks ?? [];
  const takeTask = useTakeTask();

  return (
    <div className='px-4'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>Available Jobs</h2>
        <Link to='/dashboard/jobs' className='text-primary text-xs font-medium'>
          See all
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className='text-muted-foreground py-2 text-sm'>
          No jobs available right now — check back later
        </p>
      ) : (
        <ScrollArea className='w-full pb-2'>
          <div className='flex gap-3'>
            {tasks.map((task) => (
              <div key={task.id} className='w-64 shrink-0'>
                <TaskCard
                  task={task}
                  action={
                    <Button
                      size='sm'
                      className='w-full'
                      onClick={() => takeTask.mutate(task.id)}
                      disabled={takeTask.isPending}
                    >
                      {takeTask.isPending ? 'Taking…' : 'Take'}
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation='horizontal' className='invisible' />
        </ScrollArea>
      )}
      <NotAvailableSection />
    </div>
  );
}

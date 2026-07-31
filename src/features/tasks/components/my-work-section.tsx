import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { myTasksQueryOptions } from '../api/queries';
import TaskCard from './task-card';
import TaskDetailSheet from './task-detail-sheet';

export default function MyWorkSection() {
  const { data } = useQuery(myTasksQueryOptions());
  const tasks = data?.tasks ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className='px-4'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>My Work</h2>
        <Link to='/dashboard/my-work' className='text-primary text-xs font-medium'>
          See all
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className='text-muted-foreground py-2 text-sm'>No assigned tasks</p>
      ) : (
        <div className='space-y-2.5'>
          {tasks.slice(0, 3).map((task) => (
            <div key={task.id}>
              <TaskCard
                task={task}
                action={
                  <Button
                    size='sm'
                    variant='outline'
                    className='w-full'
                    onClick={() => setSelectedId(task.id)}
                  >
                    Open
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      )}
      <TaskDetailSheet
        task={selected}
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}

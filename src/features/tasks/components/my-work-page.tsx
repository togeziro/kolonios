import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { myTasksQueryOptions } from '../api/queries';
import TaskCard from './task-card';
import TaskDetailSheet from './task-detail-sheet';

export default function MyWorkPage() {
  const { data, isLoading } = useQuery(myTasksQueryOptions());
  const tasks = data?.tasks ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const assigned = tasks.filter((t) => t.status === 'assigned');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');

  return (
    <div className='space-y-6 p-4'>
      <div>
        <h2 className='mb-3 text-sm font-semibold'>In Progress ({inProgress.length})</h2>
        {inProgress.length === 0 ? (
          <p className='text-muted-foreground text-sm'>Nothing in progress</p>
        ) : (
          <div className='space-y-2.5'>
            {inProgress.map((task) => (
              <TaskCard
                key={task.id}
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
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className='mb-3 text-sm font-semibold'>Assigned ({assigned.length})</h2>
        {assigned.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No assigned tasks</p>
        ) : (
          <div className='space-y-2.5'>
            {assigned.map((task) => (
              <TaskCard
                key={task.id}
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
            ))}
          </div>
        )}
      </div>
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

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { myTasksQueryOptions } from '../api/queries';
import TaskCard from './task-card';
import TaskDetailSheet from './task-detail-sheet';

export default function MyWorkSection() {
  const { t } = useTranslation();
  const { data } = useQuery(myTasksQueryOptions());
  const tasks = data?.tasks ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className='px-4'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='dark:text-white text-sm font-semibold'>{t('task.myWork')}</h2>
        <Link
          to='/dashboard/my-work'
          className='text-xs font-semibold text-zinc-500 transition-colors hover:text-white dark:text-zinc-500'
        >
          {t('task.seeAll')}
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className='dark:text-zinc-400 py-2 text-sm text-muted-foreground'>
          {t('task.noAssignedTasks')}
        </p>
      ) : (
        <div className='space-y-3'>
          {tasks.slice(0, 3).map((task) => (
            <div key={task.id}>
              <TaskCard
                task={task}
                action={
                  <Button
                    size='sm'
                    variant='outline'
                    className='dark:border-zinc-700/30 dark:bg-zinc-800 h-8 rounded-lg px-4 text-xs font-bold dark:text-white'
                    onClick={() => setSelectedId(task.id)}
                  >
                    {t('task.open')}
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

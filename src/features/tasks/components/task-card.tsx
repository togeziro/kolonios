import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { formatDate } from '@/lib/format';
import { getAppLocale, useAppLocale } from '@/lib/locale';
import type { Task, TaskPriority, TaskStatus } from '../api/types';

const priorityLabel: Record<TaskPriority, string> = {
  low: 'dark:text-zinc-500 text-muted-foreground',
  medium: 'dark:text-amber-400 text-amber-600',
  high: 'dark:text-red-400 text-red-600'
};

const statusBadge: Partial<Record<TaskStatus, 'outline' | 'secondary' | 'default'>> = {
  assigned: 'outline',
  in_progress: 'default',
  available: 'secondary'
};

export function formatDue(dueAt: string | null, locale: string = getAppLocale()): string {
  if (!dueAt) return 'No deadline';
  return `Due ${formatDate(new Date(dueAt), undefined, locale)}`;
}

export default function TaskCard({
  task,
  action,
  actionPlacement = 'row'
}: {
  task: Task;
  action?: ReactNode;
  actionPlacement?: 'row' | 'bottom';
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  return (
    <Card className='dark:border-zinc-800/50 flex flex-col gap-3 rounded-2xl p-4 dark:bg-zinc-900'>
      <div className='flex items-start justify-between'>
        <div className='flex flex-col'>
          <span
            className={`mb-1 text-[10px] font-bold tracking-widest uppercase ${priorityLabel[task.priority]}`}
          >
            {t(`task.${task.priority}`)} {t('task.priority')}
          </span>
          <h4 className='text-[15px] font-semibold leading-tight dark:text-white'>{task.title}</h4>
          {task.location && (
            <p className='dark:text-zinc-500 text-xs text-muted-foreground'>{task.location.name}</p>
          )}
        </div>
        {task.status !== 'available' && (
          <Badge
            variant={statusBadge[task.status]}
            className='dark:bg-zinc-800 h-5 rounded px-2 text-[10px] font-bold dark:text-zinc-400'
          >
            {task.status.replace('_', ' ')}
          </Badge>
        )}
      </div>
      <div className='dark:border-zinc-800/50 flex items-center justify-between border-t pt-2'>
        <div className='flex items-center gap-1.5 text-muted-foreground dark:text-zinc-400'>
          <Icons.clock className='h-3.5 w-3.5' />
          <span className='text-[11px]'>
            {formatDue(task.dueAt, locale)}
            {task.estimatedMinutes != null ? ` · ${task.estimatedMinutes} min` : ''}
          </span>
        </div>
        {actionPlacement === 'row' && action}
      </div>
      {actionPlacement === 'bottom' && action}
      {task.requiredSkills.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-1'>
          {task.requiredSkills.map((s) => (
            <span
              key={s}
              className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]'
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

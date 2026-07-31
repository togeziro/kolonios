import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { Task, TaskPriority, TaskStatus } from '../api/types';

const priorityBadge: Record<TaskPriority, 'outline' | 'secondary' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'destructive'
};

const statusBadge: Partial<Record<TaskStatus, 'outline' | 'secondary' | 'default'>> = {
  assigned: 'outline',
  in_progress: 'default',
  available: 'secondary'
};

export function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No deadline';
  const date = new Date(dueAt);
  return `Due ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

export default function TaskCard({ task, action }: { task: Task; action?: ReactNode }) {
  return (
    <Card className='rounded-xl p-3.5'>
      <div className='mb-1.5 flex items-center gap-1.5'>
        <span className='text-muted-foreground text-[10px] font-medium uppercase'>
          {task.task_type}
        </span>
        <Badge
          variant={priorityBadge[task.priority]}
          className='h-4 rounded-full px-1.5 text-[9px]'
        >
          {task.priority}
        </Badge>
        {task.status !== 'available' && (
          <Badge variant={statusBadge[task.status]} className='h-4 rounded-full px-1.5 text-[9px]'>
            {task.status.replace('_', ' ')}
          </Badge>
        )}
      </div>
      <p className='mb-1 text-sm font-semibold leading-tight'>{task.title}</p>
      <div className='text-muted-foreground space-y-0.5 text-[11px]'>
        {task.location && (
          <p className='flex items-center gap-1'>
            <Icons.workspace className='h-3 w-3 shrink-0' />
            {task.location.name}
          </p>
        )}
        <p className='flex items-center gap-1'>
          <Icons.clock className='h-3 w-3 shrink-0' />
          {formatDue(task.dueAt)}
          {task.estimatedMinutes != null && ` · ${task.estimatedMinutes} min`}
        </p>
      </div>
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
      {action && <div className='mt-3'>{action}</div>}
    </Card>
  );
}

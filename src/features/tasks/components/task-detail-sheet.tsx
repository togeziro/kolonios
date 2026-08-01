import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import TaskCard, { formatDue } from './task-card';
import { useTakeTask, useCompleteTask } from '../api/hooks';
import type { Task } from '../api/types';

export default function TaskDetailSheet({
  task,
  open,
  onOpenChange
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const takeTask = useTakeTask();
  const completeTask = useCompleteTask();
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='bottom' className='rounded-t-2xl'>
        {task && (
          <>
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription>
                {task.task_type} · {formatDue(task.dueAt)}
              </SheetDescription>
            </SheetHeader>
            <div className='space-y-4 pt-4'>
              {task.description && (
                <p className='text-muted-foreground text-sm'>{task.description}</p>
              )}
              <div className='text-muted-foreground space-y-1.5 text-sm'>
                {task.location && (
                  <p className='flex items-center gap-2'>
                    <Icons.workspace className='h-4 w-4' /> {task.location.name}
                  </p>
                )}
                <p className='flex items-center gap-2'>
                  <Icons.clock className='h-4 w-4' /> {formatDue(task.dueAt)}
                  {task.estimatedMinutes != null && ` · ${task.estimatedMinutes} min`}
                </p>
              </div>
              {task.requiredSkills.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {task.requiredSkills.map((s) => (
                    <Badge key={s} variant='outline' className='rounded-full'>
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              {task.status === 'available' && (
                <Button
                  className='w-full'
                  onClick={() => takeTask.mutate(task.id)}
                  disabled={takeTask.isPending}
                >
                  {takeTask.isPending ? (
                    <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.check className='mr-2 h-4 w-4' />
                  )}
                  {t('task.takeTask')}
                </Button>
              )}
              {task.status === 'in_progress' && (
                <Button
                  className='w-full'
                  variant='secondary'
                  onClick={() => completeTask.mutate(task.id)}
                  disabled={completeTask.isPending}
                >
                  {completeTask.isPending ? (
                    <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.check className='mr-2 h-4 w-4' />
                  )}
                  {t('task.markComplete')}
                </Button>
              )}
              {task.status === 'assigned' && (
                <Link to='/dashboard/my-work' className='block'>
                  <Button variant='outline' className='w-full'>
                    {t('task.openMyWork')}
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

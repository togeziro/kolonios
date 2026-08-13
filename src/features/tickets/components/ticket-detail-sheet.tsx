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
import { formatDue } from './ticket-card';
import { useAppLocale } from '@/lib/locale';
import { useTakeTicket, useCompleteTicket } from '../api/hooks';
import type { Ticket } from '../api/types';

export default function TicketDetailSheet({
  task,
  open,
  onOpenChange
}: {
  task: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const takeTicket = useTakeTicket();
  const completeTicket = useCompleteTicket();
  const { t } = useTranslation();
  const locale = useAppLocale();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='bottom' className='rounded-t-2xl'>
        {task && (
          <>
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription>
                {task.taskType} {' · '} {formatDue(task.dueAt, locale)}
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
                  <Icons.clock className='h-4 w-4' /> {formatDue(task.dueAt, locale)}
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
              {task.status === 'open' && (
                <Button
                  className='w-full'
                  onClick={() => takeTicket.mutate(task.id)}
                  disabled={takeTicket.isPending}
                >
                  {takeTicket.isPending ? (
                    <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.check className='mr-2 h-4 w-4' />
                  )}
                  {t('ticket.takeTicket')}
                </Button>
              )}
              {task.status === 'in_progress' && (
                <Button
                  className='w-full'
                  variant='secondary'
                  onClick={() => completeTicket.mutate(task.id)}
                  disabled={completeTicket.isPending}
                >
                  {completeTicket.isPending ? (
                    <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.check className='mr-2 h-4 w-4' />
                  )}
                  {t('ticket.markComplete')}
                </Button>
              )}
              {task.status === 'assigned' && (
                <Link to='/dashboard/my-work' className='block'>
                  <Button variant='outline' className='w-full'>
                    {t('ticket.openMyWork')}
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

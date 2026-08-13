import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { myTicketsQueryOptions } from '../api/queries';
import TicketCard from './ticket-card';

export default function MyWorkPage() {
  const { t } = useTranslation();
  const { data } = useQuery(myTicketsQueryOptions());
  const tickets = data?.tickets ?? [];

  const assigned = tickets.filter((t) => t.status === 'assigned');
  const inProgress = tickets.filter((t) => t.status === 'in_progress');

  return (
    <div className='space-y-6 p-4'>
      <Link
        to='/dashboard/leave'
        className='flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted'
      >
        <Icons.calendar className='size-5 text-muted-foreground' />
        {t('navigation.leave')}
      </Link>
      <div>
        <h2 className='mb-3 text-sm font-semibold'>
          {t('ticket.inProgressCount', { count: inProgress.length })}
        </h2>
        {inProgress.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{t('ticket.nothingInProgress')}</p>
        ) : (
          <div className='space-y-2.5'>
            {inProgress.map((task) => (
              <TicketCard
                key={task.id}
                task={task}
                actionPlacement={'bottom' as const}
                action={
                  <Link
                    to='/dashboard/tickets/$ticketId'
                    params={{ ticketId: String(task.id) }}
                    className='block'
                  >
                    <Button size='sm' variant='outline' className='w-full'>
                      {t('ticket.open')}
                    </Button>
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className='mb-3 text-sm font-semibold'>
          {t('ticket.assignedCount', { count: assigned.length })}
        </h2>
        {assigned.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{t('ticket.noAssignedTasks')}</p>
        ) : (
          <div className='space-y-2.5'>
            {assigned.map((task) => (
              <TicketCard
                key={task.id}
                task={task}
                actionPlacement={'bottom' as const}
                action={
                  <Link
                    to='/dashboard/tickets/$ticketId'
                    params={{ ticketId: String(task.id) }}
                    className='block'
                  >
                    <Button size='sm' variant='outline' className='w-full'>
                      {t('ticket.open')}
                    </Button>
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

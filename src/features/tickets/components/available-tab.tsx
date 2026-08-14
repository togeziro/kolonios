import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { openTicketsQueryOptions } from '../api/queries';
import TicketCard from './ticket-card';

export default function AvailableTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(openTicketsQueryOptions());
  const tasks = data?.tickets ?? [];

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className='text-muted-foreground py-8 text-center text-sm'>
        {t('ticket.noJobsAvailable')}
      </p>
    );
  }

  return (
    <div className='space-y-2.5'>
      {tasks.map((task) => (
        <TicketCard
          key={task.id}
          task={task}
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
  );
}

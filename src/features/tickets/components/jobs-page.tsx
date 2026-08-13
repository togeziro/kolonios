import { useTranslation } from 'react-i18next';
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as JobsRoute } from '@/routes/dashboard/jobs/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { openTicketsQueryOptions } from '../api/queries';
import TicketCard from './ticket-card';
import type { TicketPriority } from '../api/types';

export default function JobsPage() {
  const { t } = useTranslation();
  const { domain, priority } = useSearch({ from: JobsRoute.id });
  const navigate = useNavigate();
  const filters = {
    ...(domain ? { domain: domain as 'field' | 'backoffice' } : {}),
    ...(priority ? { priority: priority as TicketPriority } : {})
  };
  const { data, isLoading } = useQuery(openTicketsQueryOptions(filters));
  const tasks = data?.tickets ?? [];

  function setFilters(next: { domain?: 'field' | 'backoffice'; priority?: TicketPriority }) {
    navigate({ to: '/dashboard/jobs', search: next });
  }

  return (
    <div className='space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>
          {t('ticket.availableJobsCount', { count: tasks.length })}
        </h2>
        <button onClick={() => setFilters({})} className='text-muted-foreground text-xs'>
          {t('ticket.clearFilters')}
        </button>
      </div>
      <div className='flex gap-2'>
        <Select
          value={domain ?? 'all'}
          onValueChange={(v) =>
            setFilters({
              ...(v === 'all' ? {} : { domain: v as 'field' | 'backoffice' }),
              ...(priority ? { priority } : {})
            })
          }
        >
          <SelectTrigger className='w-32'>
            <SelectValue placeholder={t('ticket.domain')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('ticket.allDomains')}</SelectItem>
            <SelectItem value='field'>{t('ticket.field')}</SelectItem>
            <SelectItem value='backoffice'>{t('ticket.backoffice')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priority ?? 'all'}
          onValueChange={(v) =>
            setFilters({
              ...(domain ? { domain } : {}),
              ...(v === 'all' ? {} : { priority: v as TicketPriority })
            })
          }
        >
          <SelectTrigger className='w-28'>
            <SelectValue placeholder={t('ticket.priority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('ticket.allPriorities')}</SelectItem>
            <SelectItem value='low'>{t('ticket.low')}</SelectItem>
            <SelectItem value='medium'>{t('ticket.medium')}</SelectItem>
            <SelectItem value='high'>{t('ticket.high')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className='flex justify-center py-8'>
          <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : tasks.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          {t('ticket.noJobsAvailable')}
        </p>
      ) : (
        <div className='space-y-2.5'>
          {tasks.map((task) => (
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
                  <Button size='sm' className='w-full'>
                    {t('ticket.open')}
                  </Button>
                </Link>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

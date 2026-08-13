import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useTakeTicket } from '../api/hooks';
import { openTicketsQueryOptions } from '../api/queries';
import TicketCard from './ticket-card';
import NotAvailableSection from './not-available-section';

export default function AvailableJobsSection() {
  const { t } = useTranslation();
  const { data } = useQuery(openTicketsQueryOptions());
  const tickets = data?.tickets ?? [];
  const takeTicket = useTakeTicket();

  return (
    <div className='px-4'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='dark:text-white text-sm font-semibold'>{t('ticket.availableJobs')}</h2>
        <Link
          to='/dashboard/jobs'
          className='text-xs font-semibold text-zinc-500 hover:text-white transition-colors dark:text-zinc-500'
        >
          {t('ticket.seeAll')}
        </Link>
      </div>
      {tickets.length === 0 ? (
        <p className='dark:text-zinc-400 py-2 text-sm text-muted-foreground'>
          {t('ticket.noJobsAvailable')}
        </p>
      ) : (
        <ScrollArea className='w-full pb-2'>
          <div className='flex gap-3'>
            {tickets.map((task) => (
              <div key={task.id} className='w-[250px] shrink-0 snap-start'>
                <TicketCard
                  task={task}
                  actionPlacement={'bottom' as const}
                  action={
                    <Button
                      size='sm'
                      className='dark:bg-zinc-100 h-9 w-full rounded-lg bg-zinc-900 text-xs font-bold text-white active:scale-95 transition-transform dark:text-black'
                      onClick={() => takeTicket.mutate(task.id)}
                      disabled={takeTicket.isPending}
                    >
                      {takeTicket.isPending ? t('ticket.taking') : t('ticket.takeTicket')}
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation={'horizontal' as const} className='invisible' />
        </ScrollArea>
      )}
      <NotAvailableSection />
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as TicketsRoute } from '@/routes/dashboard/tickets/index';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { listTicketsQueryOptions } from '../api/queries';
import type { TicketStatus, Ticket } from '../api/types';

const statusBadge: Record<TicketStatus, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  open: 'secondary',
  assigned: 'outline',
  in_progress: 'default',
  submitted: 'secondary',
  approved: 'secondary',
  rejected: 'destructive',
  rework: 'destructive',
  completed: 'default',
  cancelled: 'secondary'
};

const statusOptions: { value: TicketStatus | undefined; labelKey: string; fallback: string }[] = [
  { value: undefined, fallback: 'All', labelKey: 'common.all' },
  { value: 'open', fallback: 'Open', labelKey: 'ticket.open' },
  { value: 'assigned', fallback: 'Assigned', labelKey: 'enRoute.title' },
  { value: 'in_progress', fallback: 'In Progress', labelKey: 'ticket.inProgressCount' },
  { value: 'submitted', fallback: 'Submitted', labelKey: 'ticket.submitted' },
  { value: 'completed', fallback: 'Completed', labelKey: 'ticket.completed' }
];

function TicketRow({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation();
  return (
    <Link
      to='/dashboard/tickets/$ticketId'
      params={{ ticketId: String(ticket.id) }}
      className='block'
    >
      <Card className='dark:border-zinc-800/50 space-y-2 rounded-2xl p-4 hover:dark:bg-zinc-900/80 transition-colors dark:bg-zinc-900'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0 flex-1'>
            {ticket.ticketCode && (
              <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
                {ticket.ticketCode}
              </p>
            )}
            <h3 className='truncate text-sm font-semibold leading-tight dark:text-white'>
              {ticket.title}
            </h3>
            <p className='mt-0.5 truncate text-xs text-muted-foreground'>
              {ticket.customer?.name ?? ticket.assetName ?? '-'}
            </p>
          </div>
          <Badge
            variant={statusBadge[ticket.status]}
            className='shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold'
          >
            {ticket.status === 'assigned' ? t('enRoute.title') : ticket.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className='flex flex-wrap gap-2 text-[11px] text-muted-foreground'>
          {ticket.location && (
            <span className='inline-flex items-center gap-1'>
              <Icons.location className='h-3 w-3' /> {ticket.location.name}
            </span>
          )}
          <span className='inline-flex items-center gap-1 capitalize'>
            <Icons.warning className='h-3 w-3' /> {ticket.priority}
          </span>
          <span>{ticket.taskType}</span>
          {ticket.takenByName && <span className='truncate'>· {ticket.takenByName}</span>}
        </div>
      </Card>
    </Link>
  );
}

export default function TicketListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: TicketsRoute.id }) as { status?: TicketStatus };
  const status = search.status;

  const { data, isLoading } = useQuery(listTicketsQueryOptions(status ? { status } : {}));

  const tickets = data?.tickets ?? [];

  function setStatus(next: TicketStatus | undefined) {
    navigate({ to: '/dashboard/tickets', search: next ? { status: next } : {} } as never);
  }

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='sticky top-0 z-10 border-b bg-white dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='flex items-center justify-between px-4 py-3'>
          <h1 className='text-lg font-bold tracking-tight dark:text-zinc-100'>
            {t('navigation.tickets')}
          </h1>
          <Link to='/dashboard/tickets/new'>
            <Button size='sm' variant='outline'>
              <Icons.add className='mr-1 h-4 w-4' /> {t('ticket.createTitle')}
            </Button>
          </Link>
        </div>
        <div className='no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3'>
          {statusOptions.map((opt) => {
            const active = status === opt.value;
            return (
              <button
                key={opt.labelKey + String(opt.value)}
                onClick={() => setStatus(opt.value)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {(t(opt.labelKey) as string) || opt.fallback}
              </button>
            );
          })}
        </div>
        {status === 'assigned' && (
          <p className='px-4 pb-2 text-xs text-muted-foreground'>
            {(t('enRoute.title') as string) + ' — assigned tickets are en route'}
          </p>
        )}
      </header>
      <main className='flex-1 px-4 py-4'>
        {isLoading ? (
          <div className='flex justify-center py-8'>
            <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : tickets.length === 0 ? (
          <p className='py-8 text-center text-sm text-muted-foreground'>
            {t('ticket.noOpenTickets')}
          </p>
        ) : (
          <div className='flex flex-col gap-3'>
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

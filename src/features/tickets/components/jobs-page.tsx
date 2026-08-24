import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Route as JobsRoute } from '@/routes/dashboard/jobs/index';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { dateFnsLocale } from '@/lib/format';
import { openTicketsQueryOptions } from '../api/queries';
import { useTakeTicket } from '../api/hooks';
import type { Ticket, TicketPriority, TicketDomain } from '../api/types';
import { LEG_FIXTURES, type TicketRelayInfo } from './-leg-fixtures';

const priorityConfig: Record<TicketPriority, { bg: string; text: string; labelKey: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400', labelKey: 'ticket.high' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', labelKey: 'ticket.medium' },
  low: { bg: 'bg-zinc-800', text: 'text-zinc-400', labelKey: 'ticket.low' }
};

const domainLabels: Record<TicketDomain, string> = {
  field: 'ticket.field',
  backoffice: 'ticket.backoffice'
};

function relativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateFnsLocale() });
}

function filterChipClass(active: boolean) {
  return `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
    active
      ? 'dark:bg-zinc-100 dark:text-zinc-900 bg-zinc-900 text-white'
      : 'dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 border border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
  }`;
}

function OpenTicketCard({
  ticket,
  onTake,
  disabled,
  reasons,
  relay
}: {
  ticket: Ticket;
  onTake: (id: number) => void;
  disabled?: boolean;
  reasons?: string[];
  relay?: TicketRelayInfo;
}) {
  const { t } = useTranslation();
  const p = priorityConfig[ticket.priority];

  return (
    <div className='dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-4 rounded-[1.5rem] border p-5'>
      <div className='flex items-start justify-between'>
        <div>
          <div className='mb-1 flex flex-wrap items-center gap-2'>
            <span className='dark:text-zinc-500 font-mono text-xs'>{ticket.ticketCode}</span>
            {relay && relay.legsTotal > 1 && (
              <span className='bg-sky-500/10 text-sky-400 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider'>
                {t('jobs.legBadge', { x: relay.legNumber, y: relay.legsTotal })}
              </span>
            )}
            <span
              className={`${p.bg} ${p.text} rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`}
            >
              {t(p.labelKey)}
            </span>
            <span className='dark:bg-zinc-800 dark:text-zinc-300 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700'>
              {t(domainLabels[ticket.domain])}
            </span>
          </div>
          <h3 className='dark:text-zinc-100 font-semibold leading-tight'>{ticket.title}</h3>
        </div>
        <span className='dark:bg-zinc-800 dark:text-zinc-300 shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700'>
          {t('ticket.open')}
        </span>
      </div>

      <div className='flex flex-col gap-2'>
        {ticket.location && (
          <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.location className='h-[18px] w-[18px]' />
            <span>{ticket.location.name}</span>
          </div>
        )}
        {ticket.createdByName && (
          <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.user className='h-[18px] w-[18px]' />
            <span>
              {t('ticket.openedBy')} {ticket.createdByName}
              {' · '}
              {relativeTime(ticket.createdAt)}
            </span>
          </div>
        )}
        {ticket.requiredSkills.length > 0 && (
          <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.warning className='h-[18px] w-[18px]' />
            <span>{ticket.requiredSkills.join(', ')}</span>
          </div>
        )}
      </div>

      {reasons && reasons.length > 0 && (
        <div className='dark:text-zinc-400 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-sm'>
          <Icons.warning className='mt-0.5 h-4 w-4 shrink-0' />
          <span>{reasons.join(' · ')}</span>
        </div>
      )}
      <Button
        onClick={() => onTake(ticket.id)}
        disabled={disabled}
        className='mt-2 w-full py-3 font-semibold dark:bg-zinc-100 dark:text-zinc-900 bg-zinc-900 text-white'
      >
        {t('ticket.take')}
      </Button>
    </div>
  );
}

export default function JobsPage({
  relayMap
}: { relayMap?: Record<number, TicketRelayInfo> } = {}) {
  const { t } = useTranslation();
  const { domain } = useSearch({ from: JobsRoute.id });
  const navigate = useNavigate();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canCreate = isAdmin || permissions.tickets?.add === true;
  const takeTicket = useTakeTicket();

  // TODO(wire): relay info comes from fixtures today; the wiring pass supplies
  // the real per-ticket map (same shape) and this merge becomes a no-op.
  const relays: Record<number, TicketRelayInfo> = { ...LEG_FIXTURES, ...relayMap };

  // Location/Priority filters are intentionally local state (not URL) — they
  // narrow already-fetched tickets client-side only.
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);

  const filters = domain ? { domain: domain as TicketDomain } : {};

  const { data, isLoading } = useQuery(openTicketsQueryOptions(filters));
  const tickets = data?.tickets ?? [];
  const unavailable = data?.unavailable ?? [];

  function setDomain(next: TicketDomain | undefined) {
    navigate({ to: '/dashboard/jobs', search: { domain: next } });
  }

  async function handleTake(ticketId: number) {
    const res = await takeTicket.mutateAsync(ticketId);
    if (res?.success) {
      navigate({ to: '/dashboard/tickets/$ticketId', params: { ticketId: String(ticketId) } });
    }
  }

  const chips: { label: string; value: TicketDomain | undefined }[] = [
    { label: t('ticket.allDomains'), value: undefined },
    { label: t('ticket.field'), value: 'field' },
    { label: t('ticket.backoffice'), value: 'backoffice' }
  ];

  const locationOptions = [
    ...new Set(
      tickets.map((ticket) => ticket.location?.name).filter((name): name is string => Boolean(name))
    )
  ];
  const priorityOptions: TicketPriority[] = ['high', 'medium', 'low'];

  const matchesFilters = (ticket: Ticket) =>
    (locationFilter === null || ticket.location?.name === locationFilter) &&
    (priorityFilter === null || ticket.priority === priorityFilter);
  const visibleTickets = tickets.filter(matchesFilters);
  const visibleUnavailable = unavailable.filter(matchesFilters);

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='dark:bg-zinc-950 dark:border-zinc-800 sticky top-0 z-50 border-b bg-white'>
        <div className='flex items-center justify-between px-4 py-3'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => navigate({ to: '..' })}
              className='dark:hover:bg-zinc-900 -ml-2 rounded-full p-2 transition-colors hover:bg-zinc-100'
            >
              <Icons.chevronLeft className='h-5 w-5' />
            </button>
            <h1 className='dark:text-zinc-100 text-lg font-bold tracking-tight'>
              {t('ticket.openTickets')}
            </h1>
          </div>
          {canCreate && (
            <Link to='/dashboard/tickets/new'>
              <button className='dark:hover:bg-zinc-900 -mr-2 rounded-full p-2 transition-colors hover:bg-zinc-100'>
                <Icons.add className='h-5 w-5' />
              </button>
            </Link>
          )}
        </div>

        <div className='no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3'>
          {chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => setDomain(chip.value)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
                domain === chip.value
                  ? 'dark:bg-zinc-100 dark:text-zinc-900 bg-zinc-900 text-white'
                  : 'dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 border border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </header>

      <main className='flex-1 px-4 py-4'>
        {!isLoading && tickets.length > 0 && (
          <div className='no-scrollbar mb-3 flex items-center gap-2 overflow-x-auto'>
            <span className='dark:text-zinc-500 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400'>
              {t('jobs.filterLocation')}
            </span>
            {locationOptions.map((name) => (
              <button
                key={name}
                onClick={() => setLocationFilter((current) => (current === name ? null : name))}
                className={filterChipClass(locationFilter === name)}
              >
                {name}
              </button>
            ))}
            <span className='dark:bg-zinc-800 mx-1 h-5 w-px shrink-0 bg-zinc-300' />
            <span className='dark:text-zinc-500 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400'>
              {t('jobs.filterPriority')}
            </span>
            {priorityOptions.map((priority) => (
              <button
                key={priority}
                onClick={() =>
                  setPriorityFilter((current) => (current === priority ? null : priority))
                }
                className={filterChipClass(priorityFilter === priority)}
              >
                {t(`priority.${priority}`)}
              </button>
            ))}
          </div>
        )}
        {isLoading ? (
          <div className='flex justify-center py-8'>
            <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : visibleTickets.length === 0 && visibleUnavailable.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('ticket.noOpenTickets')}
          </p>
        ) : (
          <div className='flex flex-col gap-4'>
            {visibleTickets.map((ticket) => (
              <OpenTicketCard
                key={ticket.id}
                ticket={ticket}
                onTake={handleTake}
                disabled={takeTicket.isPending}
                relay={relays[ticket.id]}
              />
            ))}
            {visibleUnavailable.length > 0 && (
              <>
                <h2 className='dark:text-zinc-500 pt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400'>
                  {t('ticket.unavailable')}
                </h2>
                {visibleUnavailable.map((ticket) => (
                  <div key={ticket.id} className='opacity-75'>
                    <OpenTicketCard
                      ticket={ticket}
                      onTake={() => {}}
                      disabled
                      reasons={ticket.eligibilityReasons}
                      relay={relays[ticket.id]}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

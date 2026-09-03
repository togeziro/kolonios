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
import { openTicketsQueryOptions, relayPoolQueryOptions } from '../api/queries';
import { useTakeTicket, useClaimLeg } from '../api/hooks';
import type { Ticket, TicketPriority, TicketDomain, RelayPoolItem } from '../api/types';

const priorityConfig: Record<TicketPriority, { bg: string; text: string; labelKey: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400', labelKey: 'ticket.high' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', labelKey: 'ticket.medium' },
  low: { bg: 'bg-zinc-800', text: 'text-zinc-400', labelKey: 'ticket.low' }
};

const domainLabels: Record<TicketDomain, string> = {
  field: 'ticket.field',
  backoffice: 'ticket.backoffice'
};

function relativeTime(dateStr: string, lng: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateFnsLocale(lng) });
}

function filterChipClass(active: boolean) {
  return `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
    active
      ? 'dark:bg-zinc-100 dark:text-zinc-900 bg-zinc-900 text-white'
      : 'dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 border border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
  }`;
}

function LegBadge({ legNumber, legsTotal }: { legNumber: number; legsTotal: number }) {
  const { t } = useTranslation();
  if (legsTotal <= 1) return null;
  return (
    <span className='bg-sky-500/10 text-sky-400 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider'>
      {t('jobs.legBadge', { x: legNumber, y: legsTotal })}
    </span>
  );
}

function TicketCard({
  ticket,
  variant,
  onAction,
  disabled,
  reasons
}: {
  ticket: Ticket | RelayPoolItem;
  variant: 'open' | 'relay';
  onAction: () => void;
  disabled?: boolean;
  reasons?: string[];
}) {
  const { t, i18n } = useTranslation();
  const p = priorityConfig[ticket.priority];
  const isRelay = variant === 'relay';
  const item = isRelay ? (ticket as RelayPoolItem) : null;

  return (
    <div className='dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-4 rounded-[1.5rem] border p-5'>
      <div className='flex items-start justify-between'>
        <div>
          <div className='mb-1 flex flex-wrap items-center gap-2'>
            <span className='dark:text-zinc-500 font-mono text-xs'>{ticket.ticketCode}</span>
            {isRelay && item ? (
              <LegBadge
                legNumber={item.claimableLeg.legNumber}
                legsTotal={item.claimableLeg.legsTotal}
              />
            ) : (
              ticket.legInfo && (
                <LegBadge
                  legNumber={ticket.legInfo.legNumber}
                  legsTotal={ticket.legInfo.legsTotal}
                />
              )
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
        {!isRelay && (
          <span className='dark:bg-zinc-800 dark:text-zinc-300 shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700'>
            {t('ticket.open')}
          </span>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        {ticket.location && (
          <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.location className='h-[18px] w-[18px]' />
            <span>{ticket.location.name}</span>
          </div>
        )}
        {isRelay && item ? (
          <>
            {ticket.takenByName && (
              <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
                <Icons.user className='h-[18px] w-[18px]' />
                <span>{t('jobs.heldBy', { name: ticket.takenByName })}</span>
              </div>
            )}
            <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
              <Icons.chevronRight className='h-[18px] w-[18px]' />
              <span>{t('jobs.claimLegHint', { name: item.claimableLeg.name })}</span>
            </div>
          </>
        ) : (
          <>
            {ticket.createdByName && (
              <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
                <Icons.user className='h-[18px] w-[18px]' />
                <span>
                  {t('ticket.openedBy')} {ticket.createdByName}
                  {' · '}
                  {relativeTime(ticket.createdAt, i18n.language)}
                </span>
              </div>
            )}
            {ticket.requiredSkills.length > 0 && (
              <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
                <Icons.warning className='h-[18px] w-[18px]' />
                <span>{ticket.requiredSkills.join(', ')}</span>
              </div>
            )}
          </>
        )}
      </div>

      {reasons && reasons.length > 0 && (
        <div className='dark:text-zinc-400 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-sm'>
          <Icons.warning className='mt-0.5 h-4 w-4 shrink-0' />
          <span>{reasons.join(' · ')}</span>
        </div>
      )}
      <Button
        onClick={onAction}
        disabled={disabled}
        className='mt-2 w-full py-3 font-semibold dark:bg-zinc-100 dark:text-zinc-900 bg-zinc-900 text-white'
      >
        {isRelay ? t('jobs.claimLeg') : t('ticket.take')}
      </Button>
    </div>
  );
}

export default function JobsPage() {
  const { t } = useTranslation();
  const { domain } = useSearch({ from: JobsRoute.id });
  const navigate = useNavigate();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canCreate = isAdmin || permissions.tickets?.add === true;
  const takeTicket = useTakeTicket();
  const claimLeg = useClaimLeg();

  // Location/Priority filters are intentionally local state (not URL) — they
  // narrow already-fetched tickets client-side only.
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);

  const filters = domain ? { domain: domain as TicketDomain } : {};

  const { data, isLoading } = useQuery(openTicketsQueryOptions(filters));
  const tickets = data?.tickets ?? [];
  const unavailable = data?.unavailable ?? [];

  const relayQuery = useQuery(relayPoolQueryOptions(filters));
  const relayTickets = relayQuery.data?.tickets ?? [];
  const relayUnavailable = relayQuery.data?.unavailable ?? [];

  function setDomain(next: TicketDomain | undefined) {
    navigate({ to: '/dashboard/jobs', search: { domain: next } });
  }

  async function handleTake(ticketId: number) {
    const res = await takeTicket.mutateAsync(ticketId);
    if (res?.success) {
      navigate({ to: '/dashboard/en-route/$ticketId', params: { ticketId: String(ticketId) } });
    }
  }

  async function handleClaim(legId: number) {
    const res = await claimLeg.mutateAsync(legId);
    if (res?.success && res.ticket) {
      navigate({
        to: '/dashboard/en-route/$ticketId',
        params: { ticketId: String(res.ticket.id) }
      });
    }
  }

  const chips: { label: string; value: TicketDomain | undefined }[] = [
    { label: t('ticket.allDomains'), value: undefined },
    { label: t('ticket.field'), value: 'field' },
    { label: t('ticket.backoffice'), value: 'backoffice' }
  ];

  const locationOptions = [
    ...new Set(
      [...tickets, ...relayTickets]
        .map((ticket) => ticket.location?.name)
        .filter((name): name is string => Boolean(name))
    )
  ];
  const priorityOptions: TicketPriority[] = ['high', 'medium', 'low'];

  const matchesFilters = (ticket: Ticket) =>
    (locationFilter === null || ticket.location?.name === locationFilter) &&
    (priorityFilter === null || ticket.priority === priorityFilter);
  const visibleTickets = tickets.filter(matchesFilters);
  const visibleUnavailable = unavailable.filter(matchesFilters);
  const visibleRelay = relayTickets.filter(matchesFilters);
  const visibleRelayUnavailable = relayUnavailable.filter(matchesFilters);

  const claimPending = claimLeg.isPending;

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
        {!isLoading && (tickets.length > 0 || relayTickets.length > 0) && (
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

        <section>
          <h2 className='dark:text-zinc-500 mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400'>
            <Icons.dashboard className='h-3.5 w-3.5' />
            {t('ticket.openTickets')}
          </h2>
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
                <TicketCard
                  key={ticket.id}
                  variant='open'
                  ticket={ticket}
                  onAction={() => handleTake(ticket.id)}
                  disabled={takeTicket.isPending}
                />
              ))}
              {visibleUnavailable.length > 0 && (
                <>
                  <h3 className='dark:text-zinc-500 pt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400'>
                    {t('ticket.unavailable')}
                  </h3>
                  {visibleUnavailable.map((ticket) => (
                    <div key={ticket.id} className='opacity-75'>
                      <TicketCard
                        variant='open'
                        ticket={ticket}
                        onAction={() => {}}
                        disabled
                        reasons={ticket.eligibilityReasons}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        <section className='mb-6'>
          <h2 className='dark:text-zinc-500 mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400'>
            <Icons.trendingUp className='h-3.5 w-3.5' />
            {t('jobs.relayTitle')}
          </h2>
          {relayQuery.isLoading ? (
            <div className='flex justify-center py-8'>
              <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : visibleRelay.length === 0 && visibleRelayUnavailable.length === 0 ? (
            <p className='text-muted-foreground py-4 text-center text-sm'>{t('jobs.relayEmpty')}</p>
          ) : (
            <div className='flex flex-col gap-4'>
              {visibleRelay.map((item) => (
                <TicketCard
                  key={item.id}
                  variant='relay'
                  ticket={item}
                  onAction={() => handleClaim(item.claimableLeg.legId)}
                  disabled={claimPending}
                />
              ))}
              {visibleRelayUnavailable.length > 0 && (
                <>
                  <h3 className='dark:text-zinc-500 pt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400'>
                    {t('ticket.unavailable')}
                  </h3>
                  {visibleRelayUnavailable.map((item) => (
                    <div key={item.id} className='opacity-75'>
                      <TicketCard
                        variant='relay'
                        ticket={item}
                        onAction={() => {}}
                        disabled
                        reasons={item.eligibilityReasons}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

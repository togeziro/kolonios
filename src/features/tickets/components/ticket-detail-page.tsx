import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Icons } from '@/components/icons';
import { useAppLocale } from '@/lib/locale';
import { formatDue } from './ticket-card';
import { ticketDetailQueryOptions } from '../api/queries';
import LegTimeline, { completedLegCount, progressFromLegs } from './leg-timeline';
import TicketActions from './ticket-actions';
import ReworkBanner, { getReworkNote } from './rework-banner';
import type { TicketStatus } from '../api/types';

const statusBadge: Partial<
  Record<TicketStatus, 'outline' | 'secondary' | 'default' | 'destructive'>
> = {
  open: 'secondary',
  assigned: 'outline',
  in_progress: 'default',
  rejected: 'destructive',
  rework: 'destructive',
  approved: 'secondary',
  submitted: 'secondary',
  completed: 'default'
};

export default function TicketDetailPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locale = useAppLocale();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));

  if (isLoading) {
    return (
      <div className='flex justify-center py-16'>
        <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  const ticket = data?.ticket;
  if (!ticket) {
    return (
      <div className='space-y-4 p-4 text-center'>
        <p className='text-muted-foreground text-sm'>{t('ticket.invalidTicket')}</p>
        <Link to='/dashboard/jobs' className='text-xs font-semibold'>
          {t('ticket.seeAll')}
        </Link>
      </div>
    );
  }

  return (
    <div className='space-y-4 p-4'>
      <button
        type='button'
        onClick={() => navigate({ to: '/dashboard/jobs' })}
        className='flex items-center gap-1 text-xs font-semibold text-muted-foreground'
      >
        <Icons.chevronLeft className='h-3.5 w-3.5' /> {t('ticket.back')}
      </button>

      {(() => {
        const note = getReworkNote(ticket);
        return note ? <ReworkBanner note={note} /> : null;
      })()}

      <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
        <div className='flex items-start justify-between gap-2'>
          <div>
            {ticket.ticketCode && (
              <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
                {ticket.ticketCode}
              </p>
            )}
            <h2 className='dark:text-white text-lg font-bold leading-tight'>{ticket.title}</h2>
          </div>
          <Badge
            variant={statusBadge[ticket.status]}
            className='dark:bg-zinc-800 h-6 rounded-full px-3 text-[11px] font-bold dark:text-zinc-300'
          >
            {ticket.status.replace('_', ' ')}
          </Badge>
        </div>
        {ticket.description && (
          <div className='space-y-1.5'>
            <p className='dark:text-zinc-400 text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
              {t('ticket.description')}
            </p>
            <p className='text-muted-foreground text-sm leading-relaxed'>{ticket.description}</p>
          </div>
        )}
        <div className='grid grid-cols-2 gap-2 text-sm'>
          {ticket.customer && (
            <p className='text-muted-foreground'>
              <span className='dark:text-zinc-400 block text-[10px] uppercase'>
                {t('ticket.formCustomer')}
              </span>
              {ticket.customer.name}
            </p>
          )}
          {ticket.assetName && (
            <p className='text-muted-foreground'>
              <span className='dark:text-zinc-400 block text-[10px] uppercase'>
                {t('ticket.formAssetName')}
              </span>
              {ticket.assetName}
            </p>
          )}
          {ticket.location && (
            <p className='text-muted-foreground'>
              <span className='dark:text-zinc-400 block text-[10px] uppercase'>
                {t('ticket.formLocation')}
              </span>
              {ticket.location.name}
            </p>
          )}
          <p className='text-muted-foreground'>
            <span className='dark:text-zinc-400 block text-[10px] uppercase'>
              {t('ticket.formTaskType')}
            </span>
            {ticket.taskType}
          </p>
          <p className='text-muted-foreground'>
            <span className='dark:text-zinc-400 block text-[10px] uppercase'>
              {t('ticket.formDueDate')}
            </span>
            {formatDue(ticket.dueAt, locale)}
          </p>
          {ticket.estimatedMinutes != null && (
            <p className='text-muted-foreground'>
              <span className='dark:text-zinc-400 block text-[10px] uppercase'>
                {t('ticket.formEstimatedMinutes')}
              </span>
              {`${ticket.estimatedMinutes} min`}
            </p>
          )}
        </div>
        {ticket.requiredSkills.length > 0 && (
          <div className='space-y-1.5'>
            <p className='dark:text-zinc-400 text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
              {t('ticket.skills')}
            </p>
            <div className='flex flex-wrap gap-1.5'>
              {ticket.requiredSkills.map((skill) => (
                <Badge
                  key={skill}
                  variant='outline'
                  className='dark:bg-zinc-800 h-6 rounded-full px-2.5 text-[11px] font-bold dark:text-zinc-300'
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
        <div className='flex items-center justify-between'>
          <h3 className='dark:text-white text-sm font-semibold'>{t('ticket.legs')}</h3>
          <span className='text-xs font-bold text-muted-foreground'>
            {progressFromLegs(ticket.legs)}
          </span>
        </div>
        <Progress
          value={(completedLegCount(ticket.legs) / Math.max(ticket.legs.length, 1)) * 100}
          className='dark:bg-zinc-800 h-1.5'
        />
        <LegTimeline legs={ticket.legs} />
      </Card>

      <TicketActions ticket={ticket} />
    </div>
  );
}

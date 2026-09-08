import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Icons } from '@/components/icons';
import LegTimeline, { completedLegCount } from './leg-timeline';
import TicketDetailEnRouteCta from './ticket-detail-en-route-cta';
import type { useTakeTicket, useStartLeg, useClaimLeg, useCompleteTicket } from '../api/hooks';
import type { DetailLegAction } from '@/lib/tickets/engine';
import type { TicketDetail } from '../api/types';

export default function TicketDetailLegsTab({
  ticket,
  canEdit,
  legAction,
  showMarkComplete,
  showMarkCompleteDisabledReason,
  markCompleteGuard,
  takeTicket,
  startLeg,
  claimLeg,
  completeTicket
}: {
  ticket: TicketDetail;
  canEdit: boolean;
  legAction: DetailLegAction;
  showMarkComplete: boolean;
  showMarkCompleteDisabledReason: string | null;
  markCompleteGuard: { reason?: 'requiresPhoto' | 'requiresReview' };
  takeTicket: ReturnType<typeof useTakeTicket>;
  startLeg: ReturnType<typeof useStartLeg>;
  claimLeg: ReturnType<typeof useClaimLeg>;
  completeTicket: ReturnType<typeof useCompleteTicket>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
      <div className='flex items-center justify-between'>
        <h3 className='dark:text-white text-sm font-semibold'>{t('ticket.legs')}</h3>
        <span className='text-xs font-bold text-muted-foreground'>
          {`${completedLegCount(ticket.legs)}/${ticket.legs.length}`}
        </span>
      </div>
      <Progress
        value={(completedLegCount(ticket.legs) / Math.max(ticket.legs.length, 1)) * 100}
        className='h-1.5 dark:bg-zinc-800'
      />
      <LegTimeline legs={ticket.legs} />
      {canEdit && (
        <div className='space-y-2 pt-2'>
          {ticket.status === 'open' && (
            <Button
              className='w-full'
              onClick={() =>
                takeTicket.mutate(ticket.id, {
                  onSuccess: (res) => {
                    if (res?.success) {
                      navigate({
                        to: '/dashboard/en-route/$ticketId',
                        params: { ticketId: String(ticket.id) }
                      });
                    }
                  }
                })
              }
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
          <TicketDetailEnRouteCta
            legAction={legAction}
            startLeg={startLeg}
            claimLeg={claimLeg}
            ticketId={ticket.id}
          />
          {showMarkComplete && (
            <Button
              variant='secondary'
              className='w-full'
              onClick={() => completeTicket.mutate(ticket.id)}
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
          {showMarkCompleteDisabledReason && (
            <div className='space-y-1'>
              <Button variant='secondary' className='w-full' disabled>
                <Icons.check className='mr-2 h-4 w-4' />
                {t('ticket.markComplete')}
              </Button>
              <p className='text-center text-[11px] text-muted-foreground'>
                {showMarkCompleteDisabledReason}
              </p>
              {markCompleteGuard.reason === 'requiresReview' && (
                <p className='text-center text-[11px] text-muted-foreground'>
                  {t('ticket.markCompleteHintWorkSession')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

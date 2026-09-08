import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { useStartLeg, useClaimLeg } from '../api/hooks';
import type { DetailLegAction } from '@/lib/tickets/engine';

/**
 * The start-leg / claim-leg primary CTA, rendered in both the Legs tab
 * (full width, with icon) and the Work Session tab (compact, no icon).
 */
export default function TicketDetailEnRouteCta({
  legAction,
  startLeg,
  claimLeg,
  ticketId,
  size = 'default'
}: {
  legAction: DetailLegAction;
  startLeg: ReturnType<typeof useStartLeg>;
  claimLeg: ReturnType<typeof useClaimLeg>;
  ticketId: number;
  size?: 'default' | 'sm';
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const compact = size === 'sm';
  const activeButtonClass = compact ? 'mt-3' : 'w-full';
  const reasonWrapperClass = compact ? 'mt-3 space-y-1' : 'space-y-1';

  if (legAction.kind === 'start-leg') {
    return (
      <Button
        variant='outline'
        size={size}
        className={activeButtonClass}
        onClick={() => startLeg.mutate(legAction.legId)}
        disabled={startLeg.isPending}
      >
        {!compact &&
          (startLeg.isPending ? (
            <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Icons.check className='mr-2 h-4 w-4' />
          ))}
        {t('ticket.startLeg')}
      </Button>
    );
  }

  if (legAction.kind === 'claim-leg') {
    if (legAction.reasons.length > 0) {
      return (
        <div className={reasonWrapperClass}>
          <Button variant='outline' size={size} className={compact ? undefined : 'w-full'} disabled>
            {!compact && <Icons.check className='mr-2 h-4 w-4' />}
            {t('jobs.claimLeg')}
          </Button>
          <p className='text-center text-[11px] text-muted-foreground'>
            {legAction.reasons.join(', ')}
          </p>
        </div>
      );
    }
    return (
      <Button
        variant='outline'
        size={size}
        className={activeButtonClass}
        onClick={() =>
          claimLeg.mutate(legAction.legId, {
            onSuccess: (res) => {
              if (res?.success) {
                navigate({
                  to: '/dashboard/en-route/$ticketId',
                  params: { ticketId: String(ticketId) }
                });
              }
            }
          })
        }
        disabled={claimLeg.isPending}
      >
        {!compact &&
          (claimLeg.isPending ? (
            <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Icons.check className='mr-2 h-4 w-4' />
          ))}
        {t('jobs.claimLeg')}
      </Button>
    );
  }

  return null;
}

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useSession } from '@/lib/auth/auth-client';
import { useTakeTicket, useStartLeg, useCompleteTicket } from '../api/hooks';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import type { TicketDetail } from '../api/types';

export default function TicketActions({ ticket }: { ticket: TicketDetail }) {
  const { t } = useTranslation();
  const takeTicket = useTakeTicket();
  const startLeg = useStartLeg();
  const completeTicket = useCompleteTicket();
  const { data: session } = useSession();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  // NOTE: DB layer is the source of truth; UI gating only hides obviously
  // impossible actions. Edit-permission check:
  const canEdit = isAdmin || permissions.tickets?.edit === true;

  if (!canEdit) return null;

  const startableLeg = ticket.legs.find((l) => l.status === 'open' || l.status === 'assigned');

  return (
    <div className='dark:border-zinc-800/50 sticky bottom-0 border-t bg-background/95 p-3 backdrop-blur dark:bg-zinc-950/95'>
      <div className='flex flex-col gap-2'>
        {ticket.status === 'open' && (
          <Button
            className='w-full'
            onClick={() => takeTicket.mutate(ticket.id)}
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
        {startableLeg && ticket.status !== 'open' && (
          <Button
            variant='outline'
            className='w-full'
            onClick={() => startLeg.mutate(startableLeg.id)}
            disabled={startLeg.isPending}
          >
            {startLeg.isPending ? (
              <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Icons.check className='mr-2 h-4 w-4' />
            )}
            {t('ticket.startLeg')}
          </Button>
        )}
        {ticket.status === 'in_progress' && (
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
      </div>
    </div>
  );
}

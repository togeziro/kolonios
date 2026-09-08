import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { ticketDetailQueryOptions } from '../api/queries';
import {
  useSubmitWorkSession,
  useStartLeg,
  useTakeTicket,
  useClaimLeg,
  useCompleteTicket
} from '../api/hooks';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { useTicketDetailActions } from './use-ticket-detail-actions';
import TicketDetailHeader from './ticket-detail-header';
import TicketDetailTabs, { type TicketDetailTab } from './ticket-detail-tabs';
import TicketDetailOverviewTab from './ticket-detail-overview';
import TicketDetailLegsTab from './ticket-detail-legs';
import TicketDetailWorkSessionTab from './ticket-detail-work-session';
import ReworkBanner, { getReworkNote } from './rework-banner';
import type { WorkLogEntryInput, WorkSessionMaterialInput } from '../api/types';

export default function TicketDetailPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));
  const takeTicket = useTakeTicket();
  const startLeg = useStartLeg();
  const claimLeg = useClaimLeg();
  const completeTicket = useCompleteTicket();
  const submit = useSubmitWorkSession();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = isAdmin || permissions.tickets?.edit === true;

  const [tab, setTab] = useState<TicketDetailTab>('legs');
  const [materials, setMaterials] = useState<WorkSessionMaterialInput[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [log, setLog] = useState<WorkLogEntryInput[]>([]);

  const actions = useTicketDetailActions({
    ticket: data?.ticket,
    isAdmin,
    canEdit,
    inputPhotoCount: photos.length
  });

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

  const finish = () => {
    submit.mutate(
      { ticketId, materials, photos: photos.map((fileUrl) => ({ fileUrl })), notes: '', log },
      {
        onSuccess: (res) => {
          if (!res?.success) return;
          if (res.isLastLeg) {
            navigate({
              to: '/dashboard/tickets/$ticketId/completed',
              params: { ticketId: String(ticketId) }
            });
          } else {
            navigate({
              to: '/dashboard/work-session/$ticketId/handoff',
              params: { ticketId: String(ticketId) }
            });
          }
        }
      }
    );
  };

  return (
    <div className='space-y-4 p-4 pb-28'>
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

      <TicketDetailHeader ticket={ticket} isField={actions.isField} />
      <TicketDetailTabs tab={tab} onTabChange={setTab} legs={ticket.legs} />

      {tab === 'overview' && (
        <TicketDetailOverviewTab ticket={ticket} domainLabel={actions.domainLabel} />
      )}

      {tab === 'legs' && (
        <TicketDetailLegsTab
          ticket={ticket}
          canEdit={canEdit}
          legAction={actions.legAction}
          showMarkComplete={actions.showMarkComplete}
          showMarkCompleteDisabledReason={actions.showMarkCompleteDisabledReason}
          markCompleteGuard={actions.markCompleteGuard}
          takeTicket={takeTicket}
          startLeg={startLeg}
          claimLeg={claimLeg}
          completeTicket={completeTicket}
        />
      )}

      {tab === 'work' && (
        <TicketDetailWorkSessionTab
          ticket={ticket}
          isInProgress={actions.isInProgress}
          isLastLeg={actions.isLastLeg}
          workGuard={actions.workGuard}
          legAction={actions.legAction}
          startLeg={startLeg}
          claimLeg={claimLeg}
          submit={submit}
          materials={materials}
          onMaterialsChange={setMaterials}
          photos={photos}
          onPhotosChange={setPhotos}
          log={log}
          onLogChange={setLog}
          onFinish={finish}
        />
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import CompletionPhotos from './completion-photos';
import MaterialsUsed from './materials-used';
import WorkLog from './work-log';
import ElapsedTimer from './elapsed-timer';
import TicketDetailEnRouteCta from './ticket-detail-en-route-cta';
import type { useStartLeg, useClaimLeg, useSubmitWorkSession } from '../api/hooks';
import type { DetailLegAction } from '@/lib/tickets/engine';
import type { TicketDetail, WorkLogEntryInput, WorkSessionMaterialInput } from '../api/types';

export default function TicketDetailWorkSessionTab({
  ticket,
  isInProgress,
  isLastLeg,
  workGuard,
  legAction,
  startLeg,
  claimLeg,
  submit,
  materials,
  onMaterialsChange,
  photos,
  onPhotosChange,
  log,
  onLogChange,
  onFinish
}: {
  ticket: TicketDetail;
  isInProgress: boolean;
  isLastLeg: boolean;
  workGuard: { allowed: boolean; reason?: 'requiresPhoto' };
  legAction: DetailLegAction;
  startLeg: ReturnType<typeof useStartLeg>;
  claimLeg: ReturnType<typeof useClaimLeg>;
  submit: ReturnType<typeof useSubmitWorkSession>;
  materials: WorkSessionMaterialInput[];
  onMaterialsChange: (materials: WorkSessionMaterialInput[]) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  log: WorkLogEntryInput[];
  onLogChange: (log: WorkLogEntryInput[]) => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className='space-y-4'>
      {!isInProgress ? (
        <Card className='dark:border-zinc-800/50 p-4 text-center dark:bg-zinc-900'>
          <p className='text-sm text-muted-foreground'>{t('workSession.notInProgress')}</p>
          <TicketDetailEnRouteCta
            size='sm'
            legAction={legAction}
            startLeg={startLeg}
            claimLeg={claimLeg}
            ticketId={ticket.id}
          />
        </Card>
      ) : (
        <>
          <ElapsedTimer takenAt={ticket.takenAt} />
          <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
            <CompletionPhotos onChange={onPhotosChange} />
          </Card>
          <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
            <MaterialsUsed materials={materials} onChange={onMaterialsChange} />
          </Card>
          <WorkLog entries={log} onChange={onLogChange} />
          <div className='fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/95 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))]'>
            <Button
              className='w-full'
              onClick={onFinish}
              disabled={submit.isPending || !workGuard.allowed}
            >
              {submit.isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Icons.check className='mr-2 h-4 w-4' />
              )}
              {isLastLeg ? t('workSession.finishSubmit') : t('workSession.submitLeg')}
            </Button>
            {!workGuard.allowed ? (
              <p className='mt-1.5 text-center text-[11px] text-muted-foreground'>
                {t('ticket.markCompleteRequiresPhoto')}
              </p>
            ) : (
              <p className='mt-1.5 text-center text-[11px] text-muted-foreground'>
                {isLastLeg ? t('workSession.finishSubmitHint') : t('workSession.submitLegHint')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

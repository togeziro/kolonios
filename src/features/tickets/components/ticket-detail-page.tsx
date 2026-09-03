import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Icons } from '@/components/icons';
import { useAppLocale } from '@/lib/locale';
import { formatDue } from './ticket-card';
import { ticketDetailQueryOptions } from '../api/queries';
import { useSubmitWorkSession, useStartLeg, useTakeTicket, useCompleteTicket } from '../api/hooks';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canCompleteTicket, workSessionSubmitAllowed } from '@/lib/tickets/engine';
import LegTimeline, { completedLegCount } from './leg-timeline';
import ReworkBanner, { getReworkNote } from './rework-banner';
import CompletionPhotos from './completion-photos';
import MaterialsUsed from './materials-used';
import WorkLog from './work-log';
import ElapsedTimer from './elapsed-timer';
import type { TicketStatus, WorkLogEntryInput, WorkSessionMaterialInput } from '../api/types';

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

const FIELD_TASK_TYPES = ['installation', 'maintenance', 'inspection'] as const;

export default function TicketDetailPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locale = useAppLocale();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));
  const takeTicket = useTakeTicket();
  const startLeg = useStartLeg();
  const completeTicket = useCompleteTicket();
  const submit = useSubmitWorkSession();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = isAdmin || permissions.tickets?.edit === true;

  const [tab, setTab] = useState<'overview' | 'legs' | 'work'>('legs');
  const [materials, setMaterials] = useState<WorkSessionMaterialInput[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [log, setLog] = useState<WorkLogEntryInput[]>([]);

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

  const isField = (FIELD_TASK_TYPES as readonly string[]).includes(ticket.taskType);
  const domainLabel = isField ? t('workSession.domainField') : t('workSession.domainBackoffice');
  const startableLeg = ticket.legs.find((l) => l.status === 'open' || l.status === 'assigned');
  const isInProgress = ticket.status === 'in_progress';
  const domain = isField ? ('field' as const) : ('backoffice' as const);
  const existingPhotoCount = ticket.photos.length;
  const markCompleteGuard = canCompleteTicket({
    domain,
    isAdmin,
    photoCount: existingPhotoCount
  });
  const workGuard = workSessionSubmitAllowed({
    existingPhotoCount,
    inputPhotoCount: photos.length
  });
  // Distinguish intermediate leg vs final leg: predicts isLastLeg client-side to label the CTA.
  // Mirrors server pickSubmittableLeg + resolveLegAdvance: in_progress first, then lowest leg_number.
  const submittableLeg = [...ticket.legs]
    .sort(
      (a, b) =>
        Number(b.status === 'in_progress') - Number(a.status === 'in_progress') ||
        a.legNumber - b.legNumber
    )
    .find((l) => ['open', 'assigned', 'in_progress'].includes(l.status));
  const hasNextLeg = submittableLeg
    ? ticket.legs.some(
        (l) => l.legNumber > submittableLeg.legNumber && ['open', 'assigned'].includes(l.status)
      )
    : false;
  const isLastLeg = isInProgress && !!submittableLeg && !hasNextLeg;
  // Field non-admin must go via Work Session → submitted → SPV review, hide Mark Complete entirely.
  const showMarkComplete = isInProgress && canEdit && markCompleteGuard.allowed;
  const showMarkCompleteDisabledReason =
    isInProgress && canEdit && !markCompleteGuard.allowed
      ? markCompleteGuard.reason === 'requiresPhoto'
        ? t('ticket.markCompleteRequiresPhoto')
        : t('ticket.markCompleteRequiresReview')
      : null;

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
            {isField ? t(`taskType.${ticket.taskType}`) : ticket.taskType}
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

      {/* Unified tabbed wizard — Variant C */}
      <div className='flex gap-2 rounded-full bg-zinc-900 p-1'>
        {(['overview', 'legs', 'work'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold ${tab === k ? 'bg-white text-zinc-900' : 'text-zinc-400'}`}
          >
            {k === 'overview'
              ? 'Overview'
              : k === 'legs'
                ? `Legs ${completedLegCount(ticket.legs)}/${ticket.legs.length}`
                : 'Work Session'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
          <div className='flex flex-wrap gap-2'>
            <Badge className='h-6 rounded-full px-3 text-[11px] font-bold'>{ticket.priority}</Badge>
            <Badge variant='outline' className='h-6 rounded-full px-3 text-[11px] font-bold'>
              {domainLabel}
            </Badge>
          </div>
          <Progress
            value={(completedLegCount(ticket.legs) / Math.max(ticket.legs.length, 1)) * 100}
            className='h-1.5 dark:bg-zinc-800'
          />
          <ElapsedTimer takenAt={ticket.takenAt} />
          <p className='text-xs text-muted-foreground'>{t('ticket.overviewHint')}</p>
        </Card>
      )}

      {tab === 'legs' && (
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
      )}

      {tab === 'work' && (
        <div className='space-y-4'>
          {!isInProgress ? (
            <Card className='dark:border-zinc-800/50 p-4 text-center dark:bg-zinc-900'>
              <p className='text-sm text-muted-foreground'>{t('workSession.notInProgress')}</p>
              {startableLeg && ticket.status !== 'open' && canEdit && (
                <Button
                  variant='outline'
                  size='sm'
                  className='mt-3'
                  onClick={() => startLeg.mutate(startableLeg.id)}
                  disabled={startLeg.isPending}
                >
                  {t('ticket.startLeg')}
                </Button>
              )}
            </Card>
          ) : (
            <>
              <ElapsedTimer takenAt={ticket.takenAt} />
              <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
                <CompletionPhotos onChange={setPhotos} />
              </Card>
              <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
                <MaterialsUsed materials={materials} onChange={setMaterials} />
              </Card>
              <WorkLog entries={log} onChange={setLog} />
              <div className='fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/95 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))]'>
                <Button
                  className='w-full'
                  onClick={finish}
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
      )}
    </div>
  );
}

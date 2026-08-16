import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { ticketDetailQueryOptions } from '../api/queries';
import { useSubmitWorkSession } from '../api/hooks';
import MaterialsUsed from './materials-used';
import CompletionPhotos from './completion-photos';
import ElapsedTimer from './elapsed-timer';
import WorkLog from './work-log';
import type { WorkLogEntryInput, WorkSessionMaterialInput } from '../api/types';

const FIELD_TASK_TYPES = ['installation', 'maintenance', 'inspection'] as const;

function stepperIndex(status: string): number {
  if (status === 'open') return 1;
  if (status === 'in_progress') return 2;
  if (status === 'completed') return 3;
  return 0; // new / unknown
}

const priorityTone: Record<string, string> = {
  high: 'bg-red-500/15 text-red-500 dark:text-red-400',
  medium: 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
  low: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400'
};

export default function WorkSessionPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));
  const submit = useSubmitWorkSession();
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
        <p className='text-sm text-muted-foreground'>{t('ticket.invalidTicket')}</p>
        <Link to='/dashboard/my-work' className='text-xs font-semibold'>
          {t('ticket.seeAll')}
        </Link>
      </div>
    );
  }

  if (ticket.status !== 'in_progress') {
    return (
      <div className='space-y-4 p-4 text-center'>
        <p className='text-sm text-muted-foreground'>{t('workSession.notInProgress')}</p>
        <Link to='/dashboard/tickets/$ticketId' params={{ ticketId: String(ticketId) }}>
          <Button variant='outline' size='sm'>
            {t('workSession.back')}
          </Button>
        </Link>
      </div>
    );
  }

  const domainLabel =
    ticket.domain === 'field' ? t('workSession.domainField') : t('workSession.domainBackoffice');
  const isField = (FIELD_TASK_TYPES as readonly string[]).includes(ticket.taskType);

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

  const steps = [0, 1, 2, 3];
  const active = stepperIndex(ticket.status);

  return (
    <div className='space-y-4 p-4 pb-28'>
      <button
        type='button'
        onClick={() => navigate({ to: '/dashboard/my-work' })}
        className='flex items-center gap-1 text-xs font-semibold text-muted-foreground'
      >
        <Icons.chevronLeft className='h-3.5 w-3.5' /> {t('workSession.back')}
      </button>

      <Card className='space-y-3 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <div className='flex items-start justify-between gap-2'>
          <div>
            {ticket.ticketCode && (
              <span className='inline-block rounded-lg bg-orange-500/15 px-2 py-1 text-[10px] font-bold tracking-widest text-orange-500 dark:text-orange-400'>
                {ticket.ticketCode}
              </span>
            )}
            <h2 className='mt-2 text-lg font-bold leading-tight dark:text-white'>{ticket.title}</h2>
          </div>
          <Badge className='h-6 rounded-full bg-green-500/15 px-3 text-[11px] font-bold text-green-500 dark:text-green-400'>
            {t('workSession.inProgress')}
          </Badge>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge
            className={`h-6 rounded-full px-3 text-[11px] font-bold ${ticket.priority === 'high' ? priorityTone.high : ticket.priority === 'medium' ? priorityTone.medium : priorityTone.low}`}
          >
            {t(`priority.${ticket.priority}`)}
          </Badge>
          <Badge variant='outline' className='h-6 rounded-full px-3 text-[11px] font-bold'>
            {domainLabel}
          </Badge>
        </div>
        <div className='grid grid-cols-2 gap-2 text-sm'>
          {ticket.customer && (
            <p className='text-muted-foreground'>
              <span className='block text-[10px] uppercase dark:text-zinc-400'>
                {t('ticket.formCustomer')}
              </span>
              {ticket.customer.name}
            </p>
          )}
          <p className='text-muted-foreground'>
            <span className='block text-[10px] uppercase dark:text-zinc-400'>
              {t('ticket.formTaskType')}
            </span>
            {isField ? t(`taskType.${ticket.taskType}`) : ticket.taskType}
          </p>
          {ticket.location && (
            <p className='text-muted-foreground'>
              <span className='block text-[10px] uppercase dark:text-zinc-400'>
                {t('ticket.formLocation')}
              </span>
              {ticket.location.name}
            </p>
          )}
        </div>
        {ticket.description && (
          <div className='space-y-1'>
            <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
              {t('workSession.instructions')}
            </p>
            <p className='text-sm leading-relaxed text-muted-foreground'>{ticket.description}</p>
          </div>
        )}
      </Card>

      <div className='flex items-center gap-1 px-1'>
        {steps.map((s) => (
          <div key={s} className='flex flex-1 flex-col items-center gap-1'>
            <div
              className={`h-1.5 w-full rounded-full ${s < active ? 'bg-green-500' : s === active ? 'bg-green-500' : 'bg-zinc-800 dark:bg-zinc-700'}`}
            />
            <span
              className={`text-[10px] font-bold uppercase ${s === active ? 'text-green-500' : 'text-muted-foreground'}`}
            >
              {t(`workSession.step${s}`)}
            </span>
          </div>
        ))}
      </div>

      <ElapsedTimer takenAt={ticket.takenAt} />

      <Card className='space-y-3 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <CompletionPhotos photos={photos} onChange={setPhotos} />
      </Card>

      <Card className='space-y-3 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <MaterialsUsed materials={materials} onChange={setMaterials} />
      </Card>

      <WorkLog entries={log} onChange={setLog} />

      <div className='fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/95 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))]'>
        <Button
          className='w-full'
          onClick={finish}
          disabled={submit.isPending || photos.length === 0}
        >
          {submit.isPending ? (
            <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Icons.check className='mr-2 h-4 w-4' />
          )}
          {t('workSession.finishSubmit')}
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { ticketDetailQueryOptions } from '../api/queries';
import { useSubmitWorkSession } from '../api/hooks';
import MaterialsUsed from './materials-used';
import CompletionPhotos from './completion-photos';
import type { WorkSessionMaterialInput } from '../api/types';

export default function WorkSessionPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));
  const submit = useSubmitWorkSession();
  const [materials, setMaterials] = useState<WorkSessionMaterialInput[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

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

  const finish = () => {
    submit.mutate(
      { ticketId, materials, photos: photos.map((fileUrl) => ({ fileUrl })), notes },
      {
        onSuccess: (res) =>
          res?.success &&
          navigate({
            to: '/dashboard/tickets/$ticketId/completed',
            params: { ticketId: String(ticketId) }
          })
      }
    );
  };

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
            <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
              {ticket.ticketCode ?? ''}
            </p>
            <h2 className='text-lg font-bold leading-tight dark:text-white'>{ticket.title}</h2>
          </div>
          <Badge className='h-6 rounded-full px-3 text-[11px] font-bold dark:bg-zinc-800 dark:text-zinc-300'>
            {ticket.status.replace('_', ' ')}
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
            {ticket.taskType}
          </p>
          <p className='text-muted-foreground'>
            <span className='block text-[10px] uppercase dark:text-zinc-400'>
              {t('ticket.priority')}
            </span>
            {ticket.priority}
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

      <Card className='space-y-3 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <CompletionPhotos photos={photos} onChange={setPhotos} />
      </Card>

      <Card className='space-y-3 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <MaterialsUsed materials={materials} onChange={setMaterials} />
      </Card>

      <Card className='space-y-2 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
          {t('workSession.notes')}
        </p>
        <Textarea
          value={notes}
          placeholder={t('workSession.notesPlaceholder')}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>

      <div className='fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/95'>
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

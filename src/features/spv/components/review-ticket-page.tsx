import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { InitialChip } from '@/components/ui/initial-chip';
import { Icons } from '@/components/icons';
import { stubAction } from '@/lib/ui/stub-action';
import { REVIEWABLE_TICKETS } from './review-ticket-fixtures';

// Priority tone classes reused from en-route-navigation.tsx.
const priorityTone: Record<string, string> = {
  high: 'bg-red-500/15 text-red-500 dark:text-red-400',
  medium: 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
  low: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400'
};

const priorityLabelKey: Record<string, string> = {
  high: 'priority.high',
  medium: 'priority.medium',
  low: 'priority.low'
};

export default function ReviewTicketPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const ticket = REVIEWABLE_TICKETS.find((tk) => tk.id === ticketId);

  if (!ticket) {
    return (
      <div className='mx-auto w-full max-w-lg px-4 py-8'>
        <p className='text-muted-foreground py-8 text-center text-sm'>{t('spvReview.notFound')}</p>
      </div>
    );
  }

  const legPct =
    ticket.legsTotal > 0 ? Math.round((ticket.legsCompleted / ticket.legsTotal) * 100) : 0;

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='dark:bg-zinc-950 dark:border-zinc-800 sticky top-0 z-50 border-b bg-white'>
        <div className='mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-3'>
          <button
            onClick={() => navigate({ to: '/dashboard/spv/review' })}
            aria-label={t('spvReview.backToQueue')}
            className='dark:hover:bg-zinc-900 -ml-2 rounded-full p-2 transition-colors hover:bg-zinc-100'
          >
            <Icons.chevronLeft className='h-5 w-5' />
          </button>
          <h1 className='dark:text-zinc-100 text-lg font-bold tracking-tight'>
            {t('spvReview.detailTitle')}
          </h1>
        </div>
      </header>

      <main className='mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-4'>
        <section className='dark:border-zinc-800/50 dark:bg-zinc-900 space-y-3 rounded-2xl border p-4'>
          <div className='flex items-start justify-between gap-2'>
            <span className='dark:text-zinc-500 font-mono text-xs'>
              {'#'}
              {ticket.code}
            </span>
            <span
              data-priority={ticket.priority}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${priorityTone[ticket.priority]}`}
            >
              {t(priorityLabelKey[ticket.priority])}
            </span>
          </div>
          <h2 className='dark:text-zinc-100 font-semibold leading-tight'>{ticket.title}</h2>

          <p className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.location className='h-[18px] w-[18px]' />
            <span>{ticket.address}</span>
          </p>
          <p className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.user className='h-[18px] w-[18px]' />
            <span>
              {t('spvReview.requesterValue', {
                name: ticket.requesterName,
                initials: ticket.requesterInitials
              })}
            </span>
          </p>
        </section>

        <section className='dark:border-zinc-800/50 dark:bg-zinc-900 space-y-3 rounded-2xl border p-4'>
          <div className='flex items-center justify-between'>
            <h3 className='dark:text-zinc-100 text-sm font-bold'>
              {t('spvReview.taskProgressLabel')}
            </h3>
            <span
              data-testid='leg-progress-label'
              className='text-muted-foreground text-xs font-medium'
            >
              {t('spvReview.legProgress', {
                completed: ticket.legsCompleted,
                total: ticket.legsTotal
              })}
            </span>
          </div>
          <div
            role='progressbar'
            aria-valuenow={legPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className='bg-background dark:bg-zinc-800 h-2 w-full overflow-hidden rounded-full'
          >
            <div
              className='h-full rounded-full bg-green-500 transition-all'
              style={{ width: `${legPct}%` }}
            />
          </div>
          <div className='dark:border-zinc-800/60 flex items-center gap-3 rounded-xl border bg-card px-3 py-2 dark:bg-zinc-950/50'>
            <InitialChip name={ticket.engineerName} size='sm' />
            <div>
              <p className='dark:text-zinc-100 text-sm font-semibold'>{ticket.engineerName}</p>
              <p className='text-muted-foreground text-xs'>{ticket.engineerRole}</p>
            </div>
          </div>
        </section>

        <section className='dark:border-zinc-800/50 dark:bg-zinc-900 space-y-3 rounded-2xl border p-4'>
          <h3 className='dark:text-zinc-100 text-sm font-bold'>{t('spvReview.evidencePhotos')}</h3>
          {ticket.photos.length > 0 ? (
            <div className='grid grid-cols-2 gap-2'>
              {ticket.photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption ?? ticket.title}
                  className='dark:border-zinc-800 h-28 w-full rounded-lg object-cover'
                />
              ))}
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>{'—'}</p>
          )}
          <blockquote className='dark:border-zinc-700/50 dark:text-zinc-300 border-l-2 pl-3 text-sm italic leading-relaxed'>
            {'“'}
            {ticket.workSummary}
            {'”'}
          </blockquote>
        </section>

        <section className='dark:border-zinc-800/50 dark:bg-zinc-900 space-y-3 rounded-2xl border p-4'>
          <h3 className='dark:text-zinc-100 text-sm font-bold'>{t('spvReview.materialsUsed')}</h3>
          <ul className='space-y-2'>
            {ticket.materials.map((material) => (
              <li
                key={material.id}
                className='dark:border-zinc-800/50 dark:bg-zinc-900 flex items-center justify-between rounded-xl border bg-card px-3 py-2 dark:bg-zinc-950/50'
              >
                <span className='inline-flex items-center gap-2 text-sm'>
                  <Icons.circleCheck className='h-4 w-4 text-green-500 dark:text-green-400' />
                  <span className='dark:text-zinc-200'>{material.name}</span>
                </span>
                <span className='text-muted-foreground text-xs font-medium'>
                  {material.quantity}
                </span>
              </li>
            ))}
          </ul>
          <span className='dark:bg-zinc-800 dark:text-zinc-300 inline-flex items-center gap-1.5 rounded-full bg-zinc-200 px-3 py-1 text-[11px] font-bold text-zinc-700'>
            <Icons.badgeCheck className='h-4 w-4' />
            {t('spvReview.sopChecklist')} {'·'}{' '}
            {t('spvReview.sopScore', { resolved: ticket.sopResolved, total: ticket.sopTotal })}
          </span>
        </section>

        <div className='sticky bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/95 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))]'>
          <div className='mx-auto flex w-full max-w-lg gap-2'>
            <button
              type='button'
              onClick={() => stubAction(t('spvReview.reject'))}
              className='dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 flex-1 rounded-full border py-3 text-sm font-semibold transition-colors'
            >
              {t('spvReview.reject')}
            </button>
            <button
              type='button'
              onClick={() => stubAction(t('spvReview.approve'))}
              className='flex-1 rounded-full bg-green-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-500'
            >
              {t('spvReview.approve')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

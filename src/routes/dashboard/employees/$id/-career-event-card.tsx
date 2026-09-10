import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  Building2,
  UserCheck,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth/auth-client';
import {
  categoryColor,
  categoryIcon,
  categoryLabel,
  formatEventDescription
} from '@/lib/career-timeline/engine';
import { formatDate, formatLongDate } from '@/lib/format';
import {
  useDeleteCareerEvent,
  type CareerTimelineEvent
} from '@/features/employees/api/career-events';

const ICON_FOR_CATEGORY: Record<string, typeof Briefcase> = {
  briefcase: Briefcase,
  building: Building2,
  'user-check': UserCheck,
  'play-circle': PlayCircle
};

const COLOR_FOR_CATEGORY: Record<string, string> = {
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  yellow: 'bg-yellow-500',
  indigo: 'bg-indigo-500',
  gray: 'bg-gray-500'
};

const PILL_TEXT_FOR_CATEGORY: Record<string, string> = {
  green: 'text-green-700 dark:text-green-300',
  purple: 'text-purple-700 dark:text-purple-300',
  yellow: 'text-yellow-700 dark:text-yellow-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
  gray: 'text-gray-700 dark:text-gray-300'
};

function effectiveDateMatchesCreatedAt(effective: string, createdAt: string): boolean {
  return effective === createdAt.slice(0, 10);
}

// Client-side mirror of the server's 5-minute correction window. It is only a
// visibility hint — `deleteCareerEventFn` re-checks every guard server-side.
const DELETE_WINDOW_MINUTES = 5;

export function CareerEventCard({ event }: { event: CareerTimelineEvent }) {
  const { t, i18n } = useTranslation();
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: session } = useSession();
  const removeEvent = useDeleteCareerEvent();
  // Read the clock once per mount (lazy initializer) so render stays pure —
  // the value is only a visibility hint, never a source of truth.
  const [mountedAt] = useState(() => Date.now());

  const colorName = categoryColor(event.category);
  const iconName = categoryIcon(event.category);
  const Icon = ICON_FOR_CATEGORY[iconName] ?? PlayCircle;
  const dotClass = COLOR_FOR_CATEGORY[colorName] ?? 'bg-gray-500';
  const pillTextClass = PILL_TEXT_FOR_CATEGORY[colorName] ?? 'text-gray-700 dark:text-gray-300';

  const currentUserId = session?.user?.id;
  const ageMinutes = (mountedAt - new Date(event.created_at).getTime()) / 60_000;
  const canDelete =
    event.actor_user_id !== null &&
    currentUserId !== undefined &&
    event.actor_user_id === currentUserId &&
    ageMinutes <= DELETE_WINDOW_MINUTES;

  const handleDelete = async () => {
    try {
      await removeEvent.mutateAsync(event.id);
      toast.success(t('employee.careerTimeline.delete.success'));
      setConfirmOpen(false);
    } catch (error) {
      const code = (error as { code?: string } | null | undefined)?.code;
      toast.error(
        code === 'CAREER_EVENT_DELETE_FORBIDDEN'
          ? t('employee.careerTimeline.delete.forbidden')
          : t('employee.careerTimeline.delete.failed')
      );
      setConfirmOpen(false);
    }
  };

  const [year, month, day] = event.effective_date.split('-');
  const recordedMetaVisible = !effectiveDateMatchesCreatedAt(
    event.effective_date,
    event.created_at
  );

  return (
    <article
      className='flex items-start gap-3'
      data-testid='career-event-item'
      data-event-id={String(event.id)}
    >
      {/* Date pill */}
      <div
        className='bg-muted flex w-14 shrink-0 flex-col items-center justify-center rounded-md py-2 text-center'
        data-testid='career-event-date-pill'
      >
        <span className='text-[10px] font-medium tracking-wide uppercase'>
          {t('employee.careerTimeline.dateMonth')}
        </span>
        <span className={cn('text-base font-semibold tabular-nums', pillTextClass)}>{month}</span>
        <span className='text-foreground text-sm font-medium tabular-nums'>{day}</span>
        <span className='text-muted-foreground text-[10px] tabular-nums'>{year}</span>
      </div>

      {/* Card */}
      <Card className='flex-1' data-size='sm'>
        <CardContent className='flex flex-col gap-2 pt-3'>
          <div className='flex items-start justify-between gap-2'>
            <Badge
              variant='secondary'
              className='gap-1'
              data-testid='career-event-badge'
              data-category={event.category}
              data-category-color={colorName}
              data-category-icon={iconName}
            >
              <span
                className={cn('inline-flex h-2 w-2 rounded-full', dotClass)}
                aria-hidden='true'
              />
              <Icon className='h-3 w-3' aria-hidden='true' />
              <span>{t(`employee.careerTimeline.category.${categoryLabel(event.category)}`)}</span>
            </Badge>
            {canDelete && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive h-7 w-7 shrink-0'
                onClick={() => setConfirmOpen(true)}
                title={t('employee.careerTimeline.delete.action')}
                aria-label={t('employee.careerTimeline.delete.action')}
                data-testid='career-event-delete'
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            )}
          </div>

          <p className='text-sm'>
            <span data-testid='career-event-from'>
              {event.from_label ?? t('employee.careerTimeline.fromNotSet')}
            </span>
            <span className='text-muted-foreground mx-1.5' aria-hidden='true'>
              {t('employee.careerTimeline.fromToSeparator')}
            </span>
            <span
              className='font-bold'
              data-testid='career-event-to'
              data-effective-date={event.effective_date}
            >
              {event.to_label}
            </span>
          </p>

          <p className='text-muted-foreground text-xs'>
            {t('employee.careerTimeline.effectiveOn')}{' '}
            {formatLongDate(event.effective_date, i18n.language)}
          </p>

          {recordedMetaVisible && (
            <p
              className='text-muted-foreground text-xs italic'
              data-testid='career-event-recorded-meta'
            >
              {event.actor_user_id
                ? t('employee.careerTimeline.recordedRelative', {
                    actor: event.actor_user_id,
                    when: formatDate(event.created_at, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  })
                : t('employee.careerTimeline.recordedRelativeSystem', {
                    when: formatDate(event.created_at, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  })}
            </p>
          )}

          {event.notes && (
            <div>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs'
                onClick={() => setNotesOpen((open) => !open)}
              >
                {notesOpen ? (
                  <>
                    <ChevronUp className='h-3 w-3' />
                    {t('employee.careerTimeline.collapseNotes')}
                  </>
                ) : (
                  <>
                    <ChevronDown className='h-3 w-3' />
                    {t('employee.careerTimeline.expandNotes')}
                  </>
                )}
              </Button>
              {notesOpen && (
                <p
                  className='bg-muted text-muted-foreground mt-1 rounded-md px-2 py-1.5 text-xs'
                  data-testid='career-event-notes'
                >
                  {event.notes}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('employee.careerTimeline.delete.confirmTitle')}
        description={t('employee.careerTimeline.delete.confirmDescription', {
          description: formatEventDescription(event)
        })}
        confirmLabel={t('employee.careerTimeline.delete.confirmAction')}
        destructive
        loading={removeEvent.isPending}
        onConfirm={handleDelete}
      />
    </article>
  );
}

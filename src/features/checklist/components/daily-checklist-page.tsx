import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BatteryCharging,
  CalendarDays,
  Camera,
  Clock,
  Gauge,
  RadioTower,
  Router,
  Thermometer,
  Zap
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { useSession } from '@/lib/auth/auth-client';
import { formatDate } from '@/lib/format';
import { useAppLocale } from '@/lib/locale';
import { uploadChecklistPhoto, PHOTO_UPLOAD_FAILED } from '@/lib/storage/upload-client';
import { checklistPhotoUrlQueryOptions, myDailyChecklistQueryOptions } from '../api/queries';
import { useSetGlobalNote, useSubmitChecklist, useUpdateChecklistItem } from '../api/hooks';
import { validateSubmission } from '../utils/submit-readiness';
import type { ChecklistItem, ChecklistItemOutcome } from '../api/types';

const itemIcons: Record<string, typeof Router> = {
  cekOlt: Router,
  cekAccu: BatteryCharging,
  cekUispRadio: RadioTower,
  cekTemp: Thermometer,
  cekUps: Zap,
  cekElectricMeter: Gauge
};

const outcomeBadge: Record<
  ChecklistItemOutcome,
  { variant: 'default' | 'secondary' | 'destructive'; className: string }
> = {
  ok: {
    variant: 'default',
    className: 'border border-emerald-800/50 bg-emerald-950/60 text-emerald-300'
  },
  issue: { variant: 'destructive', className: '' },
  pending: { variant: 'secondary', className: 'dark:bg-zinc-800 dark:text-zinc-400' }
};

function formatClock(iso: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function PhotoThumb({ photoKey }: { photoKey: string }) {
  const { data } = useQuery(checklistPhotoUrlQueryOptions(photoKey));
  if (!data?.url) return null;
  return (
    <img
      src={data.url}
      alt=''
      className='dark:border-zinc-800 h-16 w-16 rounded-lg border object-cover'
    />
  );
}

function ItemCard({
  item,
  editable,
  onOutcome,
  onNote,
  onPhoto,
  photoBusy
}: {
  item: ChecklistItem;
  editable: boolean;
  onOutcome: (outcome: ChecklistItemOutcome) => void;
  onNote: (note: string) => void;
  onPhoto: (file: File) => void;
  photoBusy: boolean;
}) {
  const { t } = useTranslation();
  const Icon = itemIcons[item.itemKey] ?? Icons.circleCheck;
  const badge = outcomeBadge[item.outcome];
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(item.note);

  const outcomes: ChecklistItemOutcome[] = ['ok', 'issue', 'pending'];

  return (
    <Card className='dark:border-zinc-800/50 flex flex-col gap-3 rounded-2xl p-4 dark:bg-zinc-900'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <span className='dark:bg-zinc-800 flex h-10 w-10 shrink-0 items-center justify-center rounded-full dark:text-zinc-300'>
            <Icon className='h-5 w-5' />
          </span>
          <h4 className='text-[15px] font-semibold leading-tight dark:text-white'>
            {t(`checklist.items.${item.itemKey}`)}
          </h4>
        </div>
        {!editable && (
          <Badge
            variant={badge.variant}
            className={`h-5 shrink-0 rounded px-2 text-[10px] font-bold ${badge.className}`}
          >
            {t(`checklist.outcome.${item.outcome}`)}
          </Badge>
        )}
      </div>

      {editable && (
        <div className='flex gap-1.5'>
          {outcomes.map((o) => (
            <button
              key={o}
              type='button'
              onClick={() => onOutcome(o)}
              disabled={photoBusy}
              className={`h-8 flex-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors ${
                item.outcome === o
                  ? o === 'ok'
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                    : o === 'issue'
                      ? 'bg-red-950/70 text-red-300 border border-red-800/60'
                      : 'dark:bg-zinc-800 bg-zinc-200 text-zinc-500'
                  : 'text-muted-foreground hover:bg-muted dark:hover:bg-zinc-800'
              }`}
            >
              {t(`checklist.outcome.${o}`)}
            </button>
          ))}
        </div>
      )}

      {(editingNote || (!editable && item.note)) && (
        <div className='flex flex-col gap-2'>
          <Textarea
            value={editingNote ? draftNote : item.note}
            readOnly={!editable || !editingNote}
            onChange={(e) => setDraftNote(e.target.value)}
            className='min-h-16 text-sm'
          />
          {editable && editingNote && (
            <div className='flex justify-end gap-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => {
                  setDraftNote(item.note);
                  setEditingNote(false);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size='sm'
                onClick={() => {
                  onNote(draftNote);
                  setEditingNote(false);
                }}
              >
                {t('common.save')}
              </Button>
            </div>
          )}
        </div>
      )}

      {editable && (
        <div className='flex items-center gap-4'>
          {!editingNote && (
            <button
              type='button'
              className='text-muted-foreground dark:text-zinc-400 flex items-center gap-1.5 text-xs font-medium'
              onClick={() => {
                setDraftNote(item.note);
                setEditingNote(true);
              }}
            >
              <Icons.edit className='h-3.5 w-3.5' /> {t('checklist.addNote')}
            </button>
          )}
          <label className='text-muted-foreground dark:text-zinc-400 flex cursor-pointer items-center gap-1.5 text-xs font-medium'>
            <Camera className='h-3.5 w-3.5' />
            {photoBusy ? t('common.loading') : t('checklist.addPhoto')}
            <input
              type='file'
              className='hidden'
              disabled={photoBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.type.startsWith('image/')) {
                    onPhoto(file);
                  } else {
                    toast.error(t('checklist.photoInvalid'));
                  }
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {item.photoKey && <PhotoThumb photoKey={item.photoKey} />}
    </Card>
  );
}

export default function DailyChecklistPage() {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { data: session } = useSession();
  const { data, isPending, isError } = useQuery(myDailyChecklistQueryOptions());
  const updateItem = useUpdateChecklistItem();
  const setNote = useSetGlobalNote();
  const submitChecklist = useSubmitChecklist();
  const [photoBusyId, setPhotoBusyId] = useState<number | null>(null);
  const [globalDraft, setGlobalDraft] = useState<string | null>(null);
  const fileBusyRef = useRef(false);

  async function handlePhoto(item: ChecklistItem, file: File) {
    if (fileBusyRef.current) return;
    fileBusyRef.current = true;
    setPhotoBusyId(item.id);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(PHOTO_UPLOAD_FAILED));
        reader.readAsDataURL(file);
      });
      const key = await uploadChecklistPhoto(dataUrl, item.id);
      updateItem.mutate({ itemId: item.id, photoKey: key });
    } catch {
      toast.error(t('checklist.updateFailed'));
    } finally {
      fileBusyRef.current = false;
      setPhotoBusyId(null);
    }
  }

  if (isPending) {
    return (
      <div className='flex h-48 items-center justify-center'>
        <Icons.spinner className='h-6 w-6 animate-spin' />
      </div>
    );
  }

  if (isError || !data?.success) {
    return (
      <Card className='dark:border-zinc-800 flex flex-col items-center gap-2 rounded-2xl p-6 text-center dark:bg-zinc-900'>
        <Icons.alertCircle className='dark:text-zinc-500 h-6 w-6' />
        <p className='dark:text-zinc-400 text-sm'>{t('checklist.loadError')}</p>
      </Card>
    );
  }

  if (data.dayStatus !== 'working' || !data.checklist) {
    return (
      <Card className='dark:border-zinc-800 flex flex-col items-center gap-2 rounded-2xl p-8 text-center dark:bg-zinc-900'>
        <CalendarDays className='dark:text-zinc-500 h-8 w-8' />
        <p className='dark:text-zinc-300 text-sm font-medium'>
          {t(`checklist.empty.${data.dayStatus}`)}
        </p>
      </Card>
    );
  }

  const checklist = data.checklist;
  const editable = checklist.status === 'draft';
  const doneCount = data.items.filter((i) => i.outcome !== 'pending').length;
  const submission = validateSubmission(data.items);

  return (
    <div className='flex flex-col gap-4 pb-24'>
      <p className='text-xs leading-relaxed text-amber-600 dark:text-amber-400'>
        {t('checklist.banner')}
      </p>

      <Card className='dark:border-zinc-800/50 grid grid-cols-3 gap-2 rounded-2xl p-4 dark:bg-zinc-900'>
        <div className='flex flex-col gap-1'>
          <span className='dark:text-zinc-500 flex items-center gap-1 text-[11px]'>
            <CalendarDays className='h-3 w-3' /> {t('checklist.dateLabel')}
          </span>
          <span className='text-[13px] font-semibold dark:text-white'>
            {formatDate(new Date(`${checklist.checklistDate}T00:00:00`), undefined, locale)}
          </span>
        </div>
        <div className='flex flex-col gap-1'>
          <span className='dark:text-zinc-500 flex items-center gap-1 text-[11px]'>
            <Icons.user className='h-3 w-3' /> {t('checklist.nameLabel')}
          </span>
          <span className='truncate text-[13px] font-semibold dark:text-white'>
            {session?.user?.name ?? '—'}
          </span>
        </div>
        <div className='flex flex-col gap-1'>
          <span className='dark:text-zinc-500 flex items-center gap-1 text-[11px]'>
            <Clock className='h-3 w-3' /> {t('checklist.shiftLabel')}
          </span>
          <span className='text-[13px] font-semibold dark:text-white'>
            {checklist.shiftStartTime && checklist.shiftEndTime
              ? `${checklist.shiftStartTime} - ${checklist.shiftEndTime}`
              : checklist.shiftName || '—'}
          </span>
        </div>
      </Card>

      <div className='flex flex-col gap-3'>
        {data.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            editable={editable}
            photoBusy={photoBusyId === item.id}
            onOutcome={(outcome) => updateItem.mutate({ itemId: item.id, outcome })}
            onNote={(note) => updateItem.mutate({ itemId: item.id, note })}
            onPhoto={(file) => handlePhoto(item, file)}
          />
        ))}
      </div>

      <Card className='dark:border-zinc-800/50 flex items-center gap-2 rounded-2xl p-3 dark:bg-zinc-900'>
        <Clock className='dark:text-zinc-500 h-4 w-4 shrink-0' />
        <span className='dark:text-zinc-400 text-xs'>
          {`${t('checklist.timeLog')} · ${t('checklist.started', { time: formatClock(checklist.startedAt) })} · ${t('checklist.ended', { time: checklist.endedAt ? formatClock(checklist.endedAt) : '--:--' })}`}
        </span>
      </Card>

      <div className='flex items-center gap-1.5 text-sm dark:text-zinc-300'>
        <Icons.forms className='text-muted-foreground h-4 w-4' />
        {t('spvReview.tasksLogged', { count: data.completedLegsCount ?? 0 })}
      </div>

      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='dark:text-zinc-400 text-sm font-medium'>
            {t('checklist.progressLabel')}
          </span>
          <span className='dark:text-zinc-300 text-sm font-bold'>
            {t('checklist.progress', { done: doneCount, total: data.items.length })}
          </span>
        </div>
        <div className='dark:bg-zinc-800 h-2 overflow-hidden rounded-full bg-zinc-200'>
          <div
            className='dark:bg-zinc-100 h-full rounded-full bg-zinc-900 transition-all'
            style={{ width: `${data.items.length ? (doneCount / data.items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {editable ? (
        <Card className='dark:border-zinc-800/50 flex flex-col gap-2 rounded-2xl p-4 dark:bg-zinc-900'>
          <span className='dark:text-zinc-400 text-xs font-semibold'>
            {t('checklist.globalNoteLabel')}
          </span>
          <Textarea
            value={globalDraft ?? checklist.globalNote}
            placeholder={t('checklist.addGlobalNote')}
            onChange={(e) => setGlobalDraft(e.target.value)}
            className='min-h-16 text-sm'
          />
          {globalDraft !== null && globalDraft !== checklist.globalNote && (
            <Button
              size='sm'
              variant='outline'
              className='self-end'
              disabled={setNote.isPending}
              onClick={() =>
                setNote.mutate(
                  { checklistId: checklist.id, note: globalDraft },
                  { onSuccess: () => setGlobalDraft(null) }
                )
              }
            >
              {t('common.save')}
            </Button>
          )}
        </Card>
      ) : (
        checklist.globalNote && (
          <Card className='dark:border-zinc-800/50 rounded-2xl p-4 dark:bg-zinc-900'>
            <span className='dark:text-zinc-400 mb-1 block text-xs font-semibold'>
              {t('checklist.globalNoteLabel')}
            </span>
            <p className='dark:text-zinc-300 text-sm'>{checklist.globalNote}</p>
          </Card>
        )
      )}

      <Button
        disabled={!editable || !submission.ready || submitChecklist.isPending}
        onClick={() => submitChecklist.mutate({ checklistId: checklist.id })}
        className='h-12 w-full rounded-xl text-sm font-semibold'
      >
        {submitChecklist.isPending ? t('common.loading') : t('checklist.submitForReview')}
      </Button>
    </div>
  );
}

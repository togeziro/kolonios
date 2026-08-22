import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  BatteryCharging,
  CalendarDays,
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
import { Icons } from '@/components/icons';
import { useSession } from '@/lib/auth/auth-client';
import { formatDate } from '@/lib/format';
import { useAppLocale } from '@/lib/locale';
import { myDailyChecklistQueryOptions } from '../api/queries';
import type { ChecklistItem, ChecklistItemOutcome } from '../api/types';

const itemIcons: Record<string, typeof Router> = {
  cekOlt: Router,
  cekAccu: BatteryCharging,
  cekUispRadio: RadioTower,
  cekTemp: Thermometer,
  cekUps: Zap,
  cekElectricMeter: Gauge
};

const outcomeBadge: Record<ChecklistItemOutcome, { variant: 'default' | 'secondary' | 'destructive'; className: string }> = {
  ok: { variant: 'default', className: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50' },
  issue: { variant: 'destructive', className: '' },
  pending: { variant: 'secondary', className: 'dark:bg-zinc-800 dark:text-zinc-400' }
};

function formatClock(iso: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ItemCard({ item }: { item: ChecklistItem }) {
  const { t } = useTranslation();
  const Icon = itemIcons[item.itemKey] ?? Icons.circleCheck;
  const badge = outcomeBadge[item.outcome];

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
        <Badge
          variant={badge.variant}
          className={`h-5 shrink-0 rounded px-2 text-[10px] font-bold ${badge.className}`}
        >
          {t(`checklist.outcome.${item.outcome}`)}
        </Badge>
      </div>
      {item.note && (
        <p className='dark:text-zinc-400 text-sm leading-relaxed dark:border-zinc-800/50 dark:bg-zinc-900 rounded-lg bg-zinc-50 p-2.5'>
          {item.note}
        </p>
      )}
    </Card>
  );
}

export default function DailyChecklistPage() {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { data: session } = useSession();
  const { data, isPending, isError } = useQuery(myDailyChecklistQueryOptions());

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
  const doneCount = data.items.filter((i) => i.outcome !== 'pending').length;

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
              : (checklist.shiftName || '—')}
          </span>
        </div>
      </Card>

      <div className='flex flex-col gap-3'>
        {data.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      <Card className='dark:border-zinc-800/50 flex items-center gap-2 rounded-2xl p-3 dark:bg-zinc-900'>
        <Clock className='dark:text-zinc-500 h-4 w-4' />
        <span className='dark:text-zinc-400 text-xs'>
          {`${t('checklist.timeLog')} · ${t('checklist.started', { time: formatClock(checklist.startedAt) })} · ${t('checklist.ended', { time: checklist.endedAt ? formatClock(checklist.endedAt) : '--:--' })}`}
        </span>
      </Card>

      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='dark:text-zinc-400 text-sm font-medium'>{t('checklist.progressLabel')}</span>
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

      <Button disabled className='h-12 w-full rounded-xl text-sm font-semibold'>
        {t('checklist.submitForReview')}
      </Button>
    </div>
  );
}

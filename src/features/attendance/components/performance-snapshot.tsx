import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { performanceStatsQueryOptions } from '../api/queries';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/format';
import { useAppLocale } from '@/lib/locale';

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function PerformanceSnapshot() {
  const { t } = useTranslation();
  const { data } = useQuery(performanceStatsQueryOptions());
  const locale = useAppLocale();
  const reports = data?.reports ?? [];
  if (reports.length === 0) return null;

  const latest = reports[reports.length - 1];
  const previous = reports[reports.length - 2];
  const score = toNumber(latest.score);
  if (score == null) return null;
  const previousScore = toNumber(previous?.score ?? null);
  const rawDelta = previousScore != null ? score - previousScore : null;
  const delta = rawDelta != null ? Math.round(rawDelta * 10) / 10 : null;
  const lastUpdated = formatDate(
    new Date(latest.date),
    { day: 'numeric', month: 'long', year: 'numeric' },
    locale
  );

  return (
    <div className='px-4 py-4'>
      <Card className='dark:border-zinc-800/50 rounded-2xl p-4 dark:bg-zinc-900'>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex flex-col'>
            <h3 className='dark:text-white text-sm font-semibold'>
              {t('attendance.yourPerformance')}
            </h3>
            <p className='dark:text-zinc-500 text-[10px] text-muted-foreground'>
              {t('attendance.lastUpdated', { date: lastUpdated })}
            </p>
          </div>
          <div className='flex flex-col items-end'>
            <span className='dark:text-white text-xl font-bold leading-none tabular-nums'>
              {score}%
            </span>
            {delta != null && (
              <span
                className={`text-[9px] font-bold ${
                  delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {delta >= 0 ? '+' : ''}
                {delta}%
              </span>
            )}
          </div>
        </div>
        <div className='dark:bg-zinc-800 h-1.5 w-full overflow-hidden rounded-full bg-muted'>
          <div
            className='dark:bg-zinc-100 h-full rounded-full bg-primary'
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      </Card>
    </div>
  );
}

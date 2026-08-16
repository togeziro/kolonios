import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';
import type { MonthGridCell } from '../utils/build-month-grid';

function StatusBadge({ today }: { today: MonthGridCell }) {
  const { t } = useTranslation();
  if (today.isHoliday) {
    return (
      <span className='inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400 border border-red-500/20'>
        <span className='h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse' />
        {t('schedule.holiday')}
      </span>
    );
  }
  if (today.isDayOff || !today.isWorkingDay) {
    return (
      <span className='inline-flex items-center gap-1.5 rounded-full bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-300 border border-orange-400/20'>
        <span className='h-1.5 w-1.5 rounded-full bg-orange-400' />
        {t('schedule.dayOff')}
      </span>
    );
  }
  return (
    <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20'>
      <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse' />
      {t('schedule.working')}
    </span>
  );
}

function formatDisplayDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date);
}

export function TodayShiftCard({
  today,
  todayDate,
  shiftName,
  locationName
}: {
  today: MonthGridCell | undefined;
  todayDate: string;
  shiftName?: string | null;
  locationName?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'id' ? 'id-ID' : 'en-US';
  const displayDate = formatDisplayDate(todayDate, locale);

  return (
    <div className='dark:border-emerald-500/20 rounded-2xl border bg-card p-5 shadow-sm dark:bg-zinc-900'>
      <div className='mb-4 flex items-start justify-between'>
        <div>
          <p className='text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
            {t('schedule.todayShift')}
          </p>
          <p className='font-bold text-xl text-foreground'>{displayDate}</p>
        </div>
        {today && <StatusBadge today={today} />}
      </div>
      {today?.isHoliday || today?.isDayOff || !today?.isWorkingDay ? (
        <p className='text-sm font-semibold'>
          {today?.isHoliday
            ? (today.holidayName ?? t('schedule.holiday'))
            : today?.isDayOff
              ? t('schedule.dayOff')
              : t('schedule.noSchedule')}
        </p>
      ) : (
        <div className='mt-5 space-y-3'>
          <div className='flex items-center space-x-3 text-foreground'>
            <Icons.clock className='h-5 w-5 text-muted-foreground' />
            <div>
              <p className='text-sm font-medium'>{shiftName ?? t('schedule.morningShift')}</p>
              <p className='text-xs text-muted-foreground'>
                {today.startTime} – {today.endTime}
              </p>
            </div>
          </div>
          <div className='flex items-center space-x-3 text-foreground'>
            <Icons.location className='h-5 w-5 text-muted-foreground' />
            <div>
              <p className='text-sm font-medium'>{locationName ?? t('schedule.mainOffice')}</p>
              <p className='text-xs text-emerald-500/70'>{t('schedule.geofenceActive')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

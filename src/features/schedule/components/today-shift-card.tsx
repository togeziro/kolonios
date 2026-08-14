import { useTranslation } from 'react-i18next';
import type { MonthGridCell } from '../utils/build-month-grid';

export function TodayShiftCard({
  today,
  todayDate
}: {
  today: MonthGridCell | undefined;
  todayDate: string;
}) {
  const { t } = useTranslation();
  return (
    <div className='dark:border-zinc-800/50 rounded-2xl border bg-card p-4 shadow-sm dark:bg-zinc-900'>
      <p className='text-xs font-medium text-muted-foreground'>
        {t('schedule.todayShift')} · {todayDate}
      </p>
      {today?.isHoliday || today?.isDayOff || !today?.isWorkingDay ? (
        <p className='mt-2 text-sm font-semibold'>
          {today?.isHoliday
            ? (today.holidayName ?? t('schedule.holiday'))
            : today?.isDayOff
              ? t('schedule.dayOff')
              : t('schedule.noSchedule')}
        </p>
      ) : (
        <div className='mt-2 space-y-1'>
          <p className='text-lg font-bold'>
            {today.startTime} – {today.endTime}
          </p>
          <p className='text-xs text-muted-foreground'>
            {t('schedule.shiftHours')} · {t('schedule.lateTolerance')}: {today.lateToleranceMinutes}{' '}
            min
          </p>
        </div>
      )}
    </div>
  );
}

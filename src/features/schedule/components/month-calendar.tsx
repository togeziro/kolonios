import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MonthGridCell } from '../utils/build-month-grid';

export function MonthCalendar({ month, cells }: { month: string; cells: MonthGridCell[] }) {
  const { t } = useTranslation();
  const weekdayLabels = [
    t('attendance.daySun'),
    t('attendance.dayMon'),
    t('attendance.dayTue'),
    t('attendance.dayWed'),
    t('attendance.dayThu'),
    t('attendance.dayFri'),
    t('attendance.daySat')
  ];
  const firstDay = cells[0]?.dayOfWeek ?? 0;
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div>
      <p className='mb-2 text-sm font-semibold'>
        {month} <span className='text-muted-foreground'>{t('schedule.month')}</span>
      </p>
      <div className='grid grid-cols-7 gap-1'>
        {weekdayLabels.map((label) => (
          <div key={label} className='text-center text-[10px] font-semibold text-muted-foreground'>
            {label}
          </div>
        ))}
        {blanks.map((i) => (
          <div key={`blank-${i}`} />
        ))}
        {cells.map((cell) => (
          <div
            key={cell.date}
            title={cell.isHoliday ? (cell.holidayName ?? undefined) : undefined}
            aria-label={
              cell.isHoliday
                ? (cell.holidayName ?? undefined)
                : cell.isDayOff
                  ? t('schedule.dayOff')
                  : undefined
            }
            className={cn(
              'flex aspect-square items-center justify-center rounded-lg text-xs',
              cell.isHoliday && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
              cell.isDayOff && 'bg-muted text-muted-foreground',
              cell.isWorkingDay &&
                !cell.isHoliday &&
                !cell.isDayOff &&
                'bg-primary/10 text-foreground',
              !cell.isWorkingDay && !cell.isHoliday && !cell.isDayOff && 'text-muted-foreground/60'
            )}
          >
            {Number(cell.date.slice(8, 10))}
          </div>
        ))}
      </div>
    </div>
  );
}

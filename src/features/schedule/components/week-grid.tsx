import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MonthGridCell } from '../utils/build-month-grid';

// null cells are blank padding for days outside the month — keeps the
// Sun..Sat column alignment stable for partial weeks at month edges.
export function WeekGrid({ cells }: { cells: (MonthGridCell | null)[] }) {
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
  return (
    <div className='grid grid-cols-7 gap-1.5'>
      {weekdayLabels.map((label) => (
        <div key={label} className='text-center text-[10px] font-semibold text-muted-foreground'>
          {label}
        </div>
      ))}
      {cells.map((cell, i) =>
        !cell ? (
          <div key={`blank-${i}`} />
        ) : (
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
              'flex aspect-square items-center justify-center rounded-lg text-xs font-medium',
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
        )
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MonthGridCell } from '../utils/build-month-grid';

function StatusDot({ cell }: { cell: MonthGridCell }) {
  if (cell.isHoliday) {
    return (
      <span className='absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-red-500 dark:bg-red-400' />
    );
  }
  if (cell.isDayOff) {
    return (
      <span className='absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-orange-400 dark:bg-orange-300' />
    );
  }
  if (cell.isWorkingDay) {
    return (
      <span className='absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500 dark:bg-emerald-400' />
    );
  }
  return null;
}

export function WeekGridLegend() {
  const { t } = useTranslation();
  return (
    <div className='mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground'>
      <span className='flex items-center gap-1'>
        <span className='h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400' />
        {t('schedule.working')}
      </span>
      <span className='flex items-center gap-1'>
        <span className='h-1.5 w-1.5 rounded-full bg-orange-400 dark:bg-orange-300' />
        {t('schedule.dayOff')}
      </span>
      <span className='flex items-center gap-1'>
        <span className='h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400' />
        {t('schedule.holiday')}
      </span>
    </div>
  );
}

// null cells are blank padding for days outside the month — keeps the
// Sun..Sat column alignment stable for partial weeks at month edges.
export function WeekGrid({ cells }: { cells: (MonthGridCell | null)[] }) {
  const { t } = useTranslation();
  const weekdayLabels = [
    t('attendance.weekSun'),
    t('attendance.weekMon'),
    t('attendance.weekTue'),
    t('attendance.weekWed'),
    t('attendance.weekThu'),
    t('attendance.weekFri'),
    t('attendance.weekSat')
  ];
  return (
    <div>
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
                'relative flex aspect-square items-center justify-center rounded-lg text-xs font-medium',
                cell.isHoliday && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                cell.isDayOff && 'bg-muted text-muted-foreground',
                cell.isWorkingDay &&
                  !cell.isHoliday &&
                  !cell.isDayOff &&
                  'bg-primary/10 text-foreground',
                !cell.isWorkingDay &&
                  !cell.isHoliday &&
                  !cell.isDayOff &&
                  'text-muted-foreground/60'
              )}
            >
              {Number(cell.date.slice(8, 10))}
              <StatusDot cell={cell} />
            </div>
          )
        )}
      </div>
      <WeekGridLegend />
    </div>
  );
}

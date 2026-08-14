import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MonthGridCell } from '../utils/build-month-grid';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekGrid({ cells }: { cells: MonthGridCell[] }) {
  const { t } = useTranslation();
  return (
    <div className='grid grid-cols-7 gap-1.5'>
      {WEEKDAY_LABELS.map((label) => (
        <div key={label} className='text-center text-[10px] font-semibold text-muted-foreground'>
          {label}
        </div>
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
      ))}
    </div>
  );
}

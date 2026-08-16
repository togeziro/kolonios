import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MonthGridCell } from '../utils/build-month-grid';

function formatMonthTitle(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

function StatusDot({ cell }: { cell: MonthGridCell }) {
  if (cell.isHoliday) {
    return (
      <span className='absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-red-500 dark:bg-red-400' />
    );
  }
  if (cell.isDayOff) {
    return (
      <span className='absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-orange-400 dark:bg-orange-300' />
    );
  }
  if (cell.isWorkingDay) {
    return (
      <span className='absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500 dark:bg-emerald-400' />
    );
  }
  return null;
}

export function MonthCalendar({ month, cells }: { month: string; cells: MonthGridCell[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'id' ? 'id-ID' : 'en-US';
  const monthTitle = formatMonthTitle(month, locale);
  const weekdayLabels = [
    t('attendance.weekSun'),
    t('attendance.weekMon'),
    t('attendance.weekTue'),
    t('attendance.weekWed'),
    t('attendance.weekThu'),
    t('attendance.weekFri'),
    t('attendance.weekSat')
  ];
  const firstDay = cells[0]?.dayOfWeek ?? 0;
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div>
      <p className='mb-2 text-center text-sm font-semibold'>{monthTitle}</p>
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
              'relative flex aspect-square items-center justify-center rounded-lg text-xs',
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
            <StatusDot cell={cell} />
          </div>
        ))}
      </div>
    </div>
  );
}

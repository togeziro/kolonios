import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { myScheduleQueryOptions } from '../api/queries';
import { buildMonthGrid, type MonthGridCell } from '../utils/build-month-grid';
import { TodayShiftCard } from './today-shift-card';
import { WeekGrid } from './week-grid';
import { MonthCalendar } from './month-calendar';
import { businessDateInTimeZone } from '@/lib/dates';
import { Icons } from '@/components/icons';

function currentMonth(): string {
  return businessDateInTimeZone(new Date()).slice(0, 7);
}

function UpcomingHolidays({ holidays }: { holidays: { date: string; name: string }[] }) {
  const { t } = useTranslation();
  if (holidays.length === 0) return null;

  return (
    <div className='pt-4 border-t border-border/50'>
      <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2'>
        {t('schedule.upcomingHolidays')}
      </p>
      <div className='space-y-2'>
        {holidays.map((h) => (
          <div
            key={h.date}
            className='flex items-center space-x-2 text-red-300 bg-red-500/5 p-3 rounded-xl border border-red-500/10'
          >
            <span className='text-lg'>🇮🇩</span>
            <span className='text-sm font-medium'>
              {h.date.slice(8, 10)} {h.date.slice(5, 7)} — {h.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MySchedulePage() {
  const { t } = useTranslation();
  const month = currentMonth();
  const { data, isPending, isError } = useQuery(myScheduleQueryOptions(month));

  const cells = data ? buildMonthGrid(month, data) : [];
  const todayStr = businessDateInTimeZone(new Date());
  const today = cells.find((c) => c.date === todayStr);

  // 7-cell week window: Sunday..Saturday containing today, padded with
  // nulls for days outside the month so weekday columns stay aligned
  const todayIndex = today ? cells.findIndex((c) => c.date === todayStr) : -1;
  const weekCells: (MonthGridCell | null)[] = [];
  if (todayIndex >= 0) {
    const startIdx = todayIndex - today!.dayOfWeek;
    for (let i = 0; i < 7; i++) {
      const idx = startIdx + i;
      weekCells.push(idx >= 0 && idx < cells.length ? cells[idx] : null);
    }
  } else {
    weekCells.push(...cells.slice(0, 7));
  }

  // Upcoming holidays: holidays on or after today, sorted by date
  const todayDate = todayStr;
  const upcomingHolidays = (data?.holidays ?? [])
    .filter((h) => h.date >= todayDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className='space-y-6'>
      {isPending ? (
        <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
      ) : isError ? (
        <p className='text-sm text-muted-foreground'>{t('schedule.loadError')}</p>
      ) : (
        <>
          <TodayShiftCard
            today={today}
            todayDate={todayStr}
            shiftName={data?.assignment?.shiftName}
          />
          <div className='space-y-2'>
            <p className='text-sm font-semibold'>{t('schedule.week')}</p>
            <WeekGrid cells={weekCells} />
          </div>
          <MonthCalendar month={month} cells={cells} />
          <UpcomingHolidays holidays={upcomingHolidays} />
        </>
      )}
    </div>
  );
}

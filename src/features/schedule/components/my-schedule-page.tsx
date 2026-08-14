import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { myScheduleQueryOptions } from '../api/queries';
import { buildMonthGrid, type MonthGridCell } from '../utils/build-month-grid';
import { TodayShiftCard } from './today-shift-card';
import { WeekGrid } from './week-grid';
import { MonthCalendar } from './month-calendar';
import { businessDateInTimeZone } from '@/lib/dates';

function currentMonth(): string {
  return businessDateInTimeZone(new Date()).slice(0, 7);
}

export default function MySchedulePage() {
  const { t } = useTranslation();
  const month = currentMonth();
  const { data } = useQuery(myScheduleQueryOptions(month));

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

  return (
    <div className='space-y-6'>
      <h1 className='text-xl font-bold'>{t('schedule.pageTitle')}</h1>
      <TodayShiftCard today={today} todayDate={todayStr} />
      <div className='space-y-2'>
        <p className='text-sm font-semibold'>{t('schedule.week')}</p>
        <WeekGrid cells={weekCells} />
      </div>
      <MonthCalendar month={month} cells={cells} />
    </div>
  );
}

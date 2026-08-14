import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { myScheduleQueryOptions } from '../api/queries';
import { buildMonthGrid } from '../utils/build-month-grid';
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

  // 7-cell week window: Sunday..Saturday containing today
  const todayIndex = today ? cells.findIndex((c) => c.date === todayStr) : -1;
  const startIdx = todayIndex >= 0 ? todayIndex - today!.dayOfWeek : 0;
  const weekCells = todayIndex >= 0 ? cells.slice(startIdx, startIdx + 7) : cells.slice(0, 7);

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

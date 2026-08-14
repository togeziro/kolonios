import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { myAchievementsQueryOptions } from '../api/queries';
import { StreakCard } from './streak-card';
import { WeeklyTargets } from './weekly-targets';
import { BadgesGrid } from './badges-grid';
import { businessDateInTimeZone } from '@/lib/dates';

function currentWeekDays(): { date: string; checkedIn: boolean; isToday: boolean }[] {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      date: dateStr,
      checkedIn: false,
      isToday: dateStr === businessDateInTimeZone(today)
    };
  });
}

export default function AchievementsPage() {
  const { t } = useTranslation();
  const { data } = useQuery(myAchievementsQueryOptions());

  const streak = data?.streak ?? { current: 0, best: 0 };
  const weekDays = currentWeekDays();

  return (
    <div className='space-y-4'>
      <StreakCard current={streak.current} best={streak.best} weekDays={weekDays} />
      {data?.weeklyTargets && <WeeklyTargets targets={data.weeklyTargets} />}
      {data?.badges && <BadgesGrid badges={data.badges} recentUnlocks={data.recentUnlocks} />}
    </div>
  );
}

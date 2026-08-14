import { useQuery } from '@tanstack/react-query';
import { myAchievementsQueryOptions } from '../api/queries';
import { StreakCard } from './streak-card';
import { WeeklyTargets } from './weekly-targets';
import { BadgesGrid } from './badges-grid';
import { buildWeekDays } from '../utils/week-days';
import { businessDateInTimeZone } from '@/lib/dates';

export default function AchievementsPage() {
  const { data } = useQuery(myAchievementsQueryOptions());

  const streak = data?.streak ?? { current: 0, best: 0 };
  const weekDays = buildWeekDays(data?.last7Days ?? [], businessDateInTimeZone(new Date()));

  return (
    <div className='space-y-4'>
      <StreakCard current={streak.current} best={streak.best} weekDays={weekDays} />
      {data?.weeklyTargets && <WeeklyTargets targets={data.weeklyTargets} />}
      {data?.badges && <BadgesGrid badges={data.badges} recentUnlocks={data.recentUnlocks} />}
    </div>
  );
}

import type { AchievementData } from '@/lib/db/achievements';

export type { AchievementData };

const TASKS_TARGET = 10;
const EARLY_CHECKINS_TARGET = 5;

export type AchievementBadge = {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
};

export type AchievementResult = {
  streak: { current: number; best: number };
  weeklyTargets: { label: string; current: number; target: number }[];
  recentUnlocks: { badgeKey: string; unlockedAt: string }[];
  badges: AchievementBadge[];
  last7Days: { date: string; checkedIn: boolean }[];
};

function evaluateBadges(data: AchievementData): AchievementBadge[] {
  return [
    {
      key: 'olt_master',
      title: 'OLT Master',
      description: 'Complete 10 OLT checks',
      icon: 'phone',
      unlocked: data.inspectionCompleted >= 10
    },
    {
      key: 'early_bird',
      title: 'Early Bird',
      description: 'Check in before 07:00',
      icon: 'sun',
      unlocked: data.monthEarlyCheckIns >= 5
    },
    {
      key: 'fast_finisher',
      title: 'Fast Finisher',
      description: 'Finish 5 tasks under 30 min',
      icon: 'clock',
      unlocked: data.fastFinisherCount >= 5
    },
    {
      key: 'all_rounder',
      title: 'All-rounder',
      description: 'Complete 3 backoffice tasks',
      icon: 'badgeCheck',
      unlocked: data.uniqueTaskTypes.length >= 3
    },
    {
      key: 'reliable',
      title: 'Reliable',
      description: '30 days without missed attendance',
      icon: 'badgeCheck',
      unlocked: data.currentStreak >= 30
    },
    {
      key: 'night_owl',
      title: 'Night Owl',
      description: 'Complete a shift after 20:00',
      icon: 'moon',
      unlocked: data.monthNightOwlCheckOuts >= 3
    }
  ];
}

export function evaluateAchievements(data: AchievementData): AchievementResult {
  const badges = evaluateBadges(data);

  const recentUnlocks = badges
    .filter((b) => b.unlocked)
    .map((b) => ({ badgeKey: b.key, unlockedAt: new Date().toISOString() }));

  return {
    streak: { current: data.currentStreak, best: data.bestStreak },
    weeklyTargets: [
      { label: 'tasksCompleted', current: data.weekTasksCompleted, target: TASKS_TARGET },
      { label: 'earlyCheckIns', current: data.monthEarlyCheckIns, target: EARLY_CHECKINS_TARGET }
    ],
    recentUnlocks,
    badges,
    last7Days: data.last7Days
  };
}

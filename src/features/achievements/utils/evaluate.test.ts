import { describe, expect, it } from 'vitest';
import { evaluateAchievements } from './evaluate';
import type { AchievementData } from '@/lib/db/achievements';

function achievementData(overrides: Partial<AchievementData> = {}): AchievementData {
  return {
    currentStreak: 0,
    bestStreak: 0,
    last7Days: [],
    monthEarlyCheckIns: 0,
    monthNightOwlCheckOuts: 0,
    inspectionCompleted: 0,
    totalCompleted: 0,
    uniqueTaskTypes: [],
    fastFinisherCount: 0,
    weekTasksCompleted: 0,
    ...overrides
  };
}

describe('evaluateAchievements', () => {
  it('returns zero streak when no attendance data', () => {
    const result = evaluateAchievements(achievementData());
    expect(result.streak.current).toBe(0);
    expect(result.streak.best).toBe(0);
  });

  it('computes streak from currentStreak and bestStreak', () => {
    const result = evaluateAchievements(achievementData({ currentStreak: 12, bestStreak: 21 }));
    expect(result.streak.current).toBe(12);
    expect(result.streak.best).toBe(21);
  });

  it('returns weekly targets with correct fractions', () => {
    const result = evaluateAchievements(achievementData({ weekTasksCompleted: 6 }));
    expect(result.weeklyTargets).toHaveLength(2);
    expect(result.weeklyTargets[0]).toEqual({ label: 'tasksCompleted', current: 6, target: 10 });
    expect(result.weeklyTargets[1]).toEqual({ label: 'earlyCheckIns', current: 0, target: 5 });
  });

  it('unlocks OLT Master when 10+ inspection tickets', () => {
    const result = evaluateAchievements(achievementData({ inspectionCompleted: 10 }));
    const badge = result.badges.find((b) => b.key === 'olt_master');
    expect(badge?.unlocked).toBe(true);
  });

  it('locks OLT Master when fewer than 10 inspection tickets', () => {
    const result = evaluateAchievements(achievementData({ inspectionCompleted: 9 }));
    const badge = result.badges.find((b) => b.key === 'olt_master');
    expect(badge?.unlocked).toBe(false);
  });

  it('unlocks Early Bird when 5+ early check-ins', () => {
    const result = evaluateAchievements(achievementData({ monthEarlyCheckIns: 5 }));
    const badge = result.badges.find((b) => b.key === 'early_bird');
    expect(badge?.unlocked).toBe(true);
  });

  it('unlocks Fast Finisher when 5+ fast completions', () => {
    const result = evaluateAchievements(achievementData({ fastFinisherCount: 5 }));
    const badge = result.badges.find((b) => b.key === 'fast_finisher');
    expect(badge?.unlocked).toBe(true);
  });

  it('unlocks All-rounder when 3+ unique task types', () => {
    const result = evaluateAchievements(
      achievementData({ uniqueTaskTypes: ['installation', 'maintenance', 'inspection'] })
    );
    const badge = result.badges.find((b) => b.key === 'all_rounder');
    expect(badge?.unlocked).toBe(true);
  });

  it('unlocks Reliable when 30+ day streak', () => {
    const result = evaluateAchievements(achievementData({ currentStreak: 30 }));
    const badge = result.badges.find((b) => b.key === 'reliable');
    expect(badge?.unlocked).toBe(true);
  });

  it('unlocks Night Owl when 3+ late check-outs', () => {
    const result = evaluateAchievements(achievementData({ monthNightOwlCheckOuts: 3 }));
    const badge = result.badges.find((b) => b.key === 'night_owl');
    expect(badge?.unlocked).toBe(true);
  });

  it('returns exactly 6 badges', () => {
    const result = evaluateAchievements(achievementData());
    expect(result.badges).toHaveLength(6);
  });

  it('returns recent unlocks for all unlocked badges', () => {
    const result = evaluateAchievements(
      achievementData({ monthEarlyCheckIns: 5, currentStreak: 30 })
    );
    expect(result.recentUnlocks.length).toBe(2);
    expect(result.recentUnlocks.map((u) => u.badgeKey)).toContain('early_bird');
    expect(result.recentUnlocks.map((u) => u.badgeKey)).toContain('reliable');
  });
});

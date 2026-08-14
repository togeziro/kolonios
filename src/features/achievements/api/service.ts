import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';

export const getMyAchievementsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('achievements', 'view');
  const { getAchievementData } = await import('@/lib/db/achievements');
  const { evaluateAchievements } = await import('@/features/achievements/utils/evaluate');
  const raw = await getAchievementData(session.user.id);
  return evaluateAchievements(raw);
});

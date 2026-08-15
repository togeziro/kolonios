import { queryOptions } from '@tanstack/react-query';
import { getMyAchievementsFn } from './service';

export const achievementKeys = {
  all: ['achievements'] as const,
  my: () => [...achievementKeys.all, 'my'] as const
};

export const myAchievementsQueryOptions = () =>
  queryOptions({
    queryKey: achievementKeys.my(),
    queryFn: () => getMyAchievementsFn()
  });

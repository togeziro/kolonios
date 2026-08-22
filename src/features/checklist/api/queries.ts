import { queryOptions } from '@tanstack/react-query';
import { getMyDailyChecklistFn } from './service';

export const checklistKeys = {
  all: ['checklist'] as const,
  mine: () => [...checklistKeys.all, 'mine'] as const
};

export const myDailyChecklistQueryOptions = () =>
  queryOptions({
    queryKey: checklistKeys.mine(),
    queryFn: () => getMyDailyChecklistFn()
  });

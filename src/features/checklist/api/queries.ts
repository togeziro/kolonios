import { queryOptions } from '@tanstack/react-query';
import { getMyDailyChecklistFn } from './service';
import { getObjectUrlFn } from '@/features/storage/api/service';

export const checklistKeys = {
  all: ['checklist'] as const,
  mine: () => [...checklistKeys.all, 'mine'] as const
};

export const myDailyChecklistQueryOptions = () =>
  queryOptions({
    queryKey: checklistKeys.mine(),
    queryFn: () => getMyDailyChecklistFn()
  });

export const checklistPhotoUrlQueryOptions = (key: string) =>
  queryOptions({
    queryKey: [...checklistKeys.all, 'photo', key] as const,
    queryFn: () => getObjectUrlFn({ data: { key } }),
    enabled: key.length > 0
  });

import { queryOptions } from '@tanstack/react-query';
import { getMyDailyChecklistFn, getReviewSubmissionsFn } from './service';
import { getObjectUrlFn } from '@/features/storage/api/service';
import type { DailyChecklistResponse } from './types';

export const checklistKeys = {
  all: ['checklist'] as const,
  mine: () => [...checklistKeys.all, 'mine'] as const,
  reviewQueue: () => [...checklistKeys.all, 'reviewQueue'] as const
};

export const myDailyChecklistQueryOptions = () =>
  queryOptions({
    queryKey: checklistKeys.mine(),
    queryFn: (): Promise<DailyChecklistResponse> => getMyDailyChecklistFn()
  });

export const checklistPhotoUrlQueryOptions = (key: string) =>
  queryOptions({
    queryKey: [...checklistKeys.all, 'photo', key] as const,
    queryFn: () => getObjectUrlFn({ data: { key } }),
    enabled: key.length > 0
  });

export const reviewQueueQueryOptions = () =>
  queryOptions({
    queryKey: checklistKeys.reviewQueue(),
    queryFn: () => getReviewSubmissionsFn()
  });

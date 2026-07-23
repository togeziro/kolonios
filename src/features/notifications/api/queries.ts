import { queryOptions } from '@tanstack/react-query';
import { getNotificationsFn } from './service';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const
};

export const notificationListQueryOptions = () =>
  queryOptions({
    queryKey: notificationKeys.list(),
    queryFn: () => getNotificationsFn()
  });

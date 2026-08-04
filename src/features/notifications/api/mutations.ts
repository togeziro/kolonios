import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { logger } from '@/lib/logger';
import { markAsReadFn, markAllAsReadFn, addNotificationFn, removeNotificationFn } from './service';
import { notificationKeys } from './queries';
import type { AddNotificationPayload } from './types';

export const markAsReadMutation = mutationOptions({
  mutationFn: (id: string) => markAsReadFn({ data: { id } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    logger.error({ err }, 'Failed to mark notification as read');
  }
});

export const markAllAsReadMutation = mutationOptions({
  mutationFn: () => markAllAsReadFn(),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    logger.error({ err }, 'Failed to mark all notifications as read');
  }
});

export const addNotificationMutation = mutationOptions({
  mutationFn: (data: AddNotificationPayload) => addNotificationFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    logger.error({ err }, 'Failed to add notification');
  }
});

export const removeNotificationMutation = mutationOptions({
  mutationFn: (id: string) => removeNotificationFn({ data: { id } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    logger.error({ err }, 'Failed to remove notification');
  }
});

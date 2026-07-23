import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { markAsReadFn, markAllAsReadFn, addNotificationFn, removeNotificationFn } from './service';
import { notificationKeys } from './queries';
import type { AddNotificationPayload } from './types';

export const markAsReadMutation = mutationOptions({
  mutationFn: (id: number) => markAsReadFn({ data: { id } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    console.error('Failed to mark notification as read:', err);
  }
});

export const markAllAsReadMutation = mutationOptions({
  mutationFn: () => markAllAsReadFn(),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    console.error('Failed to mark all notifications as read:', err);
  }
});

export const addNotificationMutation = mutationOptions({
  mutationFn: (data: AddNotificationPayload) => addNotificationFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    console.error('Failed to add notification:', err);
  }
});

export const removeNotificationMutation = mutationOptions({
  mutationFn: (id: number) => removeNotificationFn({ data: { id } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    console.error('Failed to remove notification:', err);
  }
});

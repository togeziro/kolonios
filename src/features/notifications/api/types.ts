import type { NotificationAction } from '@/components/ui/notification-card';

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: string;
  actions?: NotificationAction[];
};

export type AddNotificationPayload = {
  title: string;
  body: string;
  actions?: NotificationAction[];
};

export type MarkAsReadPayload = {
  id: number;
};

export type RemoveNotificationPayload = {
  id: number;
};

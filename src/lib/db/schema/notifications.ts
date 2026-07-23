import { pgEnum, pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import type { NotificationAction } from '@/components/ui/notification-card';

export const notificationStatusEnum = pgEnum('notification_status', ['unread', 'read', 'archived']);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: notificationStatusEnum('status').notNull().default('unread'),
  actions: jsonb('actions').$type<NotificationAction[]>(),
  user_id: text('user_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

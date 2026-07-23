import { and, desc, eq } from 'drizzle-orm';
import { db } from './index';
import { DomainError, mapDbError } from '../errors';
import { notifications } from './schema/notifications';
import type { NotificationAction } from '@/components/ui/notification-card';

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: string;
  actions?: NotificationAction[];
};

function toNotification(row: typeof notifications.$inferSelect): NotificationRow {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    actions: row.actions ?? undefined
  };
}

export async function getNotifications(userId: string): Promise<NotificationRow[]> {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, userId))
      .orderBy(desc(notifications.created_at));
    return rows.map(toNotification);
  } catch (e) {
    mapDbError(e, 'notifications.getNotifications');
  }
}

export async function markAsRead(id: number, userId: string) {
  try {
    await db
      .update(notifications)
      .set({ status: 'read', updated_at: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)));
  } catch (e) {
    mapDbError(e, 'notifications.markAsRead');
  }
}

export async function markAllAsRead(userId: string) {
  try {
    await db
      .update(notifications)
      .set({ status: 'read', updated_at: new Date() })
      .where(and(eq(notifications.status, 'unread'), eq(notifications.user_id, userId)));
  } catch (e) {
    mapDbError(e, 'notifications.markAllAsRead');
  }
}

export async function addNotification(data: {
  title: string;
  body: string;
  userId: string;
  actions?: NotificationAction[];
}) {
  try {
    const [created] = await db
      .insert(notifications)
      .values({
        title: data.title,
        body: data.body,
        user_id: data.userId,
        actions: data.actions ?? null
      })
      .returning();

    if (!created) {
      throw new DomainError('Failed to create notification');
    }

    return toNotification(created);
  } catch (e) {
    mapDbError(e, 'notifications.addNotification');
  }
}

export async function removeNotification(id: number, userId: string) {
  try {
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)));
  } catch (e) {
    mapDbError(e, 'notifications.removeNotification');
  }
}

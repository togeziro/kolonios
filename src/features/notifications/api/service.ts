import { createServerFn } from '@tanstack/react-start';
import { requireSession } from '@/lib/auth/session';
import { markAsReadSchema, removeNotificationSchema, addNotificationSchema } from './validation';
import type { AddNotificationPayload } from './types';

export const getNotificationsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireSession();
  const { getNotifications } = await import('@/lib/db/notifications');
  return getNotifications(session.user.id);
});

export const markAsReadFn = createServerFn({ method: 'POST' })
  .validator(markAsReadSchema)
  .handler(async ({ data: { id } }) => {
    const session = await requireSession();
    const { markAsRead } = await import('@/lib/db/notifications');
    await markAsRead(id, session.user.id);
    return { success: true };
  });

export const markAllAsReadFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await requireSession();
  const { markAllAsRead } = await import('@/lib/db/notifications');
  await markAllAsRead(session.user.id);
  return { success: true };
});

export const addNotificationFn = createServerFn({ method: 'POST' })
  .validator(addNotificationSchema)
  .handler(async ({ data }: { data: AddNotificationPayload }) => {
    const session = await requireSession();
    const { addNotification } = await import('@/lib/db/notifications');
    return addNotification({ ...data, userId: session.user.id });
  });

export const removeNotificationFn = createServerFn({ method: 'POST' })
  .validator(removeNotificationSchema)
  .handler(async ({ data: { id } }) => {
    const session = await requireSession();
    const { removeNotification } = await import('@/lib/db/notifications');
    await removeNotification(id, session.user.id);
    return { success: true };
  });

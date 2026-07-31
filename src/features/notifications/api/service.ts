import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequestContext } from '@/lib/request-id';
import { withAudit } from '@/lib/audit';
import { markAsReadSchema, removeNotificationSchema, addNotificationSchema } from './validation';
import type { AddNotificationPayload } from './types';

export const getNotificationsFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    const session = await requirePermission('notifications', 'view');
    const { getNotifications } = await import('@/lib/db/notifications');
    return getNotifications(session.user.id);
  })
);

export const markAsReadFn = createServerFn({ method: 'POST' })
  .validator(markAsReadSchema)
  .handler(async ({ data: { id } }) =>
    withRequestContext(async () => {
      const session = await requirePermission('notifications', 'view');
      await checkRateLimit(`write:${session.user.id}`);
      const { markAsRead } = await import('@/lib/db/notifications');
      await markAsRead(id, session.user.id);
      return { success: true };
    })
  );

export const markAllAsReadFn = createServerFn({ method: 'POST' }).handler(async () =>
  withRequestContext(async () => {
    const session = await requirePermission('notifications', 'view');
    await checkRateLimit(`write:${session.user.id}`);
    const { markAllAsRead } = await import('@/lib/db/notifications');
    await markAllAsRead(session.user.id);
    return { success: true };
  })
);

export const addNotificationFn = createServerFn({ method: 'POST' })
  .validator(addNotificationSchema)
  .handler(async ({ data }: { data: AddNotificationPayload }) =>
    withRequestContext(async () => {
      const session = await requirePermission('notifications', 'view');
      await checkRateLimit(`write:${session.user.id}`);
      const { addNotification } = await import('@/lib/db/notifications');
      const created = await addNotification({ ...data, userId: session.user.id });
      await withAudit(
        session.user.id,
        {
          action: 'notification.add',
          entityType: 'notification',
          entityId: created.id,
          before: null,
          after: created
        },
        async () => undefined
      );
      return created;
    })
  );

export const removeNotificationFn = createServerFn({ method: 'POST' })
  .validator(removeNotificationSchema)
  .handler(async ({ data: { id } }) =>
    withRequestContext(async () => {
      const session = await requirePermission('notifications', 'view');
      await checkRateLimit(`write:${session.user.id}`);
      const { removeNotification } = await import('@/lib/db/notifications');
      await removeNotification(id, session.user.id);
      await withAudit(
        session.user.id,
        {
          action: 'notification.remove',
          entityType: 'notification',
          entityId: String(id),
          before: null,
          after: null
        },
        async () => undefined
      );
      return { success: true };
    })
  );

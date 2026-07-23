import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  addNotification,
  removeNotification
} from './notifications';
import { resetDatabase } from '@/test-utils/db';
import { db } from '@/lib/db';
import { notifications } from './schema/notifications';

const TEST_USER_ID = 'test-user-123';

describe('notifications data access (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();

    await db.insert(notifications).values([
      {
        title: 'Welcome',
        body: 'Welcome to the dashboard',
        status: 'unread',
        user_id: TEST_USER_ID,
        actions: [{ id: 'view', label: 'Get started', type: 'redirect', style: 'primary' }]
      },
      {
        title: 'Old alert',
        body: 'This was already read',
        status: 'read',
        user_id: TEST_USER_ID,
        actions: null
      }
    ]);
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it('returns only the requesting user notifications ordered by created_at descending', async () => {
    // insert a notification for a different user — should not appear
    await db.insert(notifications).values({
      title: 'Other user notification',
      body: 'Should not be visible',
      status: 'unread',
      user_id: 'other-user-456'
    });

    const rows = await getNotifications(TEST_USER_ID);
    expect(rows).toHaveLength(2);

    const t0 = new Date(rows[0].createdAt).getTime();
    const t1 = new Date(rows[1].createdAt).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);
  });

  it('returns notifications with the correct shape', async () => {
    const rows = await getNotifications(TEST_USER_ID);
    const welcome = rows.find((n) => n.title === 'Welcome')!;
    expect(welcome).toMatchObject({
      id: expect.any(String),
      title: 'Welcome',
      body: 'Welcome to the dashboard',
      status: 'unread',
      actions: expect.arrayContaining([
        expect.objectContaining({ id: 'view', label: 'Get started' })
      ])
    });
  });

  it('marks a single notification as read', async () => {
    const [{ id }] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.title, 'Welcome'))
      .limit(1);

    await markAsRead(id, TEST_USER_ID);

    const rows = await getNotifications(TEST_USER_ID);
    const updated = rows.find((n) => n.id === String(id))!;
    expect(updated.status).toBe('read');
  });

  it('does not mark another users notification as read', async () => {
    const [{ id }] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.title, 'Welcome'))
      .limit(1);

    await markAsRead(id, 'other-user-456');

    const rows = await getNotifications(TEST_USER_ID);
    const unchanged = rows.find((n) => n.id === String(id))!;
    expect(unchanged.status).toBe('unread');
  });

  it('marks all unread notifications as read for the requesting user only', async () => {
    // insert an unread notification for another user — should stay unread
    await db.insert(notifications).values({
      title: 'Other user unread',
      body: 'Should remain unread',
      status: 'unread',
      user_id: 'other-user-456'
    });

    await markAllAsRead(TEST_USER_ID);

    const rows = await getNotifications(TEST_USER_ID);
    for (const n of rows) {
      expect(n.status).toBe('read');
    }

    // other user's notification should still be unread
    const otherRows = await getNotifications('other-user-456');
    expect(otherRows).toHaveLength(1);
    expect(otherRows[0].status).toBe('unread');
  });

  it('adds a new notification with user_id and returns it', async () => {
    const created = await addNotification({
      title: 'Test notification',
      body: 'This was added via the data layer',
      userId: TEST_USER_ID,
      actions: [{ id: 'open', label: 'View', type: 'redirect', style: 'primary' }]
    });

    expect(created.title).toBe('Test notification');
    expect(created.status).toBe('unread');
    expect(created.id).toEqual(expect.any(String));

    const all = await getNotifications(TEST_USER_ID);
    expect(all).toHaveLength(3);
  });

  it('removes a notification by id for the requesting user', async () => {
    const rows = await getNotifications(TEST_USER_ID);
    const target = rows.find((n) => n.title === 'Old alert')!;

    await removeNotification(Number(target.id), TEST_USER_ID);

    const all = await getNotifications(TEST_USER_ID);
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Welcome');
  });

  it('does not remove another users notification', async () => {
    // insert a notification owned by another user with same title
    const [other] = await db
      .insert(notifications)
      .values({
        title: 'Other alert',
        body: 'Belongs to other user',
        status: 'unread',
        user_id: 'other-user-456'
      })
      .returning();

    await removeNotification(other.id, TEST_USER_ID);

    const otherRows = await getNotifications('other-user-456');
    expect(otherRows).toHaveLength(1);
  });

  it('handles removing a non-existent id without error', async () => {
    await expect(removeNotification(999_999, TEST_USER_ID)).resolves.not.toThrow();
  });
});

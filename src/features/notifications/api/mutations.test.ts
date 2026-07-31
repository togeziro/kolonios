import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  markAsReadFn: vi.fn(),
  markAllAsReadFn: vi.fn(),
  addNotificationFn: vi.fn(),
  removeNotificationFn: vi.fn()
}));

import { notificationKeys } from './queries';
import {
  addNotificationMutation,
  markAllAsReadMutation,
  markAsReadMutation,
  removeNotificationMutation
} from './mutations';
import { addNotificationFn, markAllAsReadFn, markAsReadFn, removeNotificationFn } from './service';

describe('notificationKeys', () => {
  it('shapes query keys', () => {
    expect(notificationKeys.all).toEqual(['notifications']);
    expect(notificationKeys.list()).toEqual(['notifications', 'list']);
  });
});

describe('notification mutations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('markAsReadMutation passes the id through', () => {
    const options = markAsReadMutation;
    expect(options.mutationFn).toBeTypeOf('function');
    options.mutationFn!('42', undefined as never);
    expect(markAsReadFn).toHaveBeenCalledWith({ data: { id: '42' } });
    expect(options.onSuccess).toBeTypeOf('function');
    expect(options.onError).toBeTypeOf('function');
  });

  it('markAllAsReadMutation calls the server function without args', () => {
    const options = markAllAsReadMutation;
    options.mutationFn!(undefined as never, undefined as never);
    expect(markAllAsReadFn).toHaveBeenCalledWith();
  });

  it('addNotificationMutation passes the payload through', () => {
    const options = addNotificationMutation;
    const payload = { title: 't', body: 'b' };
    options.mutationFn!(payload, undefined as never);
    expect(addNotificationFn).toHaveBeenCalledWith({ data: payload });
  });

  it('removeNotificationMutation passes the id through', () => {
    const options = removeNotificationMutation;
    options.mutationFn!('9', undefined as never);
    expect(removeNotificationFn).toHaveBeenCalledWith({ data: { id: '9' } });
  });

  it('invalidates the notification list on success', async () => {
    const { getQueryClient } = await import('@/lib/query-client');
    const client = getQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    await markAsReadMutation.onSuccess!(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: notificationKeys.all });
  });

  it('logs on error without throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      markAsReadMutation.onError!(
        new Error('boom'),
        undefined as never,
        undefined as never,
        undefined as never
      )
    ).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to mark notification as read:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});

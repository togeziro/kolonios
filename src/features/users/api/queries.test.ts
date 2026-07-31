import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getUsersFn: vi.fn(),
  createUserFn: vi.fn(),
  updateUserFn: vi.fn(),
  deleteUserFn: vi.fn()
}));

import { userKeys } from './queries';
import { usersQueryOptions } from './queries';
import { createUserMutation, deleteUserMutation, updateUserMutation } from './mutations';
import { createUserFn, deleteUserFn, getUsersFn, updateUserFn } from './service';

describe('userKeys', () => {
  it('shapes query keys', () => {
    expect(userKeys.all).toEqual(['users']);
    const filters = { page: 1 };
    expect(userKeys.list(filters)).toEqual(['users', 'list', filters]);
    expect(userKeys.detail('usr-1')).toEqual(['users', 'detail', 'usr-1']);
  });
});

describe('user query options', () => {
  it('usersQueryOptions passes filters through', () => {
    const filters = { page: 1 };
    const options = usersQueryOptions(filters);
    expect(options.queryKey).toEqual(['users', 'list', filters]);
    options.queryFn!(undefined as never);
    expect(getUsersFn).toHaveBeenCalledWith({ data: filters });
  });
});

describe('user mutations', () => {
  const payload = { name: 'Sam', email: 'sam@example.com', role: 'employee', status: 'active' };

  it('createUserMutation passes the payload through', () => {
    createUserMutation.mutationFn!(payload, undefined as never);
    expect(createUserFn).toHaveBeenCalledWith({ data: payload });
    expect(createUserMutation.onSuccess).toBeTypeOf('function');
  });

  it('updateUserMutation passes id and values through', () => {
    updateUserMutation.mutationFn!({ id: 'usr-1', values: payload }, undefined as never);
    expect(updateUserFn).toHaveBeenCalledWith({ data: { id: 'usr-1', values: payload } });
  });

  it('deleteUserMutation passes the id through', () => {
    deleteUserMutation.mutationFn!('usr-1', undefined as never);
    expect(deleteUserFn).toHaveBeenCalledWith({ data: 'usr-1' });
  });

  it('invalidates the user list on success', async () => {
    const { getQueryClient } = await import('@/lib/query-client');
    const invalidateSpy = vi.spyOn(getQueryClient(), 'invalidateQueries');
    await createUserMutation.onSuccess!(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: userKeys.all });
  });
});

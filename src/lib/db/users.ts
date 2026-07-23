/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth/auth.server';
import { mapDbError } from '../errors';
import type { UserFilters, UsersResponse, UserMutationPayload } from '@/features/users/api/types';

function toUser(betterUser: any) {
  const nameParts = (betterUser.name || '').split(' ');
  return {
    id: Number.parseInt(betterUser.id, 10) || 0,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    email: betterUser.email || '',
    phone: null as string | null,
    status: betterUser.banned ? 'Inactive' : 'Active',
    role: betterUser.role || 'user',
    created_at: betterUser.createdAt || new Date().toISOString(),
    updated_at: betterUser.updatedAt || new Date().toISOString()
  };
}

export async function getUsers(filters: UserFilters): Promise<UsersResponse> {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    const headers = getRequestHeaders();
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const offset = (page - 1) * limit;

    const result: any = await auth.api.listUsers({
      headers,
      query: { limit, offset, sortBy: filters.sort || 'createdAt' }
    });

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Users fetched from Better Auth',
      total_users: result.total || 0,
      offset,
      limit,
      users: (result.users || []).map(toUser)
    };
  } catch (e) {
    mapDbError(e, 'users.getUsers');
  }
}

export async function createUser(data: UserMutationPayload) {
  try {
    const created: any = await (auth.api as any).createUser({
      body: {
        email: data.email,
        password: Math.random().toString(36).slice(-12),
        name: `${data.first_name} ${data.last_name}`.trim(),
        role: data.role || 'user'
      }
    });

    return { success: true, message: 'User created successfully', user: toUser(created) };
  } catch (e) {
    mapDbError(e, 'users.createUser');
  }
}

export async function updateUser(id: number, data: UserMutationPayload) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    const headers = getRequestHeaders();
    const usersList: any = await auth.api.listUsers({ headers, query: { limit: 1 } });
    if (!usersList.users?.length) {
      return { success: false, message: `User with ID ${id} not found` };
    }

    const targetId = usersList.users[0].id as string;
    const updated: any = await (auth.api as any).updateUser({
      body: {
        name: `${data.first_name} ${data.last_name}`.trim(),
        role: data.role || 'user',
        banned: data.status === 'Inactive' || undefined,
        banReason: data.status === 'Inactive' ? 'Deactivated by admin' : undefined
      },
      params: { userId: targetId }
    });

    return { success: true, message: 'User updated successfully', user: toUser(updated) };
  } catch (e) {
    mapDbError(e, 'users.updateUser');
  }
}

export async function deleteUser(id: number) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    const headers = getRequestHeaders();
    const usersList: any = await auth.api.listUsers({ headers, query: { limit: 1 } });
    if (!usersList.users?.length) {
      return { success: false, message: `User with ID ${id} not found` };
    }

    const targetId = usersList.users[0].id as string;
    await auth.api.removeUser({ body: { userId: targetId } });
    return { success: true, message: 'User deleted successfully' };
  } catch (e) {
    mapDbError(e, 'users.deleteUser');
  }
}

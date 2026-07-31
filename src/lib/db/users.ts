/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth.server';
import { mapDbError } from '../errors';
import { db } from './index';
import { user } from './auth-schema';
import type { UserFilters, UsersResponse, UserMutationPayload } from '@/features/users/api/types';

function toUser(betterUser: any) {
  return {
    id: betterUser.id as string,
    name: betterUser.name || '',
    email: betterUser.email || '',
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
        name: data.name,
        role: data.role || 'user'
      }
    });

    return { success: true, message: 'User created successfully', user: toUser(created) };
  } catch (e) {
    mapDbError(e, 'users.createUser');
  }
}

export async function updateUser(id: string, data: UserMutationPayload) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    getRequestHeaders();
    const updated: any = await (auth.api as any).updateUser({
      body: {
        name: data.name,
        role: data.role || 'user',
        banned: data.status === 'Inactive' || undefined,
        banReason: data.status === 'Inactive' ? 'Deactivated by admin' : undefined
      },
      params: { userId: id }
    });

    return { success: true, message: 'User updated successfully', user: toUser(updated) };
  } catch (e) {
    mapDbError(e, 'users.updateUser');
  }
}

export async function deleteUser(id: string) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    getRequestHeaders();
    await auth.api.removeUser({ body: { userId: id } });
    return { success: true, message: 'User deleted successfully' };
  } catch (e) {
    mapDbError(e, 'users.deleteUser');
  }
}

export async function getUserForAudit(id: string) {
  try {
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (e) {
    mapDbError(e, 'users.getUserForAudit');
  }
}

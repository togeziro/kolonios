/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth.server';
import { mapDbError } from '../errors';
import { db } from './index';
import { user } from './auth-schema';
import { userRoleGroups } from './schema/user-role-groups';
import { roleGroups } from './schema/role-groups';
import { mapRoleGroupToLegacyRole, setUserRoleGroup } from './role-groups';
import type { UserFilters, UsersResponse, UserMutationPayload } from '@/features/users/api/types';

function toUser(betterUser: any, roleGroup?: { id: string; name: string } | null) {
  return {
    id: betterUser.id as string,
    name: betterUser.name || '',
    email: betterUser.email || '',
    status: betterUser.banned ? 'Inactive' : 'Active',
    role: betterUser.role || 'user',
    role_group_id: roleGroup?.id ?? null,
    role_group_name: roleGroup?.name ?? null,
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

    const userIds = (result.users || []).map((u: any) => u.id as string);

    const rgMap = new Map<string, { id: string; name: string }>();
    if (userIds.length > 0) {
      const allRows = await db
        .select({
          user_id: userRoleGroups.user_id,
          id: roleGroups.id,
          name: roleGroups.name
        })
        .from(userRoleGroups)
        .innerJoin(roleGroups, eq(userRoleGroups.role_group_id, roleGroups.id));

      for (const row of allRows) {
        if (userIds.includes(row.user_id)) {
          rgMap.set(row.user_id, { id: row.id, name: row.name });
        }
      }
    }

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Users fetched from Better Auth',
      total_users: result.total || 0,
      offset,
      limit,
      users: (result.users || []).map((u: any) => toUser(u, rgMap.get(u.id) ?? null))
    };
  } catch (e) {
    mapDbError(e, 'users.getUsers');
  }
}

export async function createUser(data: UserMutationPayload) {
  try {
    const legacyRole = data.role || (data.role_group_id ? 'employee' : 'user');
    const created: any = await (auth.api as any).createUser({
      body: {
        email: data.email,
        password: Math.random().toString(36).slice(-12),
        name: data.name,
        role: legacyRole
      }
    });

    const userId = created.id as string;

    if (data.role_group_id) {
      const { getRoleGroupById } = await import('./role-groups');
      const rg = await getRoleGroupById(data.role_group_id);
      if (rg.success) {
        await setUserRoleGroup(userId, data.role_group_id);
        const syncedRole = mapRoleGroupToLegacyRole(rg.role_group!.name);
        if (syncedRole !== legacyRole) {
          await (auth.api as any).updateUser({
            body: { role: syncedRole },
            params: { userId }
          } as any);
        }
        created.role = syncedRole;
      }
    }

    return { success: true, message: 'User created successfully', user: toUser(created) };
  } catch (e) {
    mapDbError(e, 'users.createUser');
  }
}

export async function updateUser(id: string, data: UserMutationPayload) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    getRequestHeaders();

    let finalRole = data.role || 'user';

    if (data.role_group_id) {
      await setUserRoleGroup(id, data.role_group_id);
      const { getRoleGroupById } = await import('./role-groups');
      const rg = await getRoleGroupById(data.role_group_id);
      if (rg.success) {
        finalRole = mapRoleGroupToLegacyRole(rg.role_group!.name);
      }
    }

    const updated: any = await (auth.api as any).updateUser({
      body: {
        name: data.name,
        role: finalRole,
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

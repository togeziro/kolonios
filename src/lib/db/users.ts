import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth.server';
import { mapDbError } from '../errors';
import { db } from './index';
import { user } from './auth-schema';
import { userRoleGroups } from './schema/user-role-groups';
import { roleGroups } from './schema/role-groups';
import { mapRoleGroupToLegacyRole, setUserRoleGroup } from './role-groups';
import type { UserFilters, UsersResponse, UserMutationPayload } from '@/features/users/api/types';
import { generateTemporaryPassword } from '../auth/password';

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  banned: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

type AdminUserList = {
  users: AdminUser[];
  total: number;
};

type AdminAuthApi = {
  listUsers: (opts: {
    headers: Headers;
    query: { limit: number; offset: number; sortBy: string };
  }) => Promise<AdminUserList>;
  createUser: (opts: {
    body: {
      email: string;
      password: string;
      name: string;
      role: string;
    };
  }) => Promise<AdminUser>;
  updateUser: (opts: {
    body: {
      name?: string;
      role: string;
      banned?: boolean;
      banReason?: string;
    };
    params: { userId: string };
  }) => Promise<AdminUser>;
  removeUser: (opts: { body: { userId: string } }) => Promise<{ success: boolean }>;
};

const adminApi = auth.api as unknown as AdminAuthApi;

function toUser(betterUser: AdminUser, roleGroup?: { id: string; name: string } | null) {
  return {
    id: betterUser.id,
    name: betterUser.name || '',
    email: betterUser.email || '',
    status: betterUser.banned ? 'Inactive' : 'Active',
    role: betterUser.role || 'user',
    role_group_id: roleGroup?.id ?? null,
    role_group_name: roleGroup?.name ?? null,
    created_at: betterUser.createdAt.toISOString(),
    updated_at: betterUser.updatedAt.toISOString()
  };
}

export async function getUsers(filters: UserFilters): Promise<UsersResponse> {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    const headers = getRequestHeaders();
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const offset = (page - 1) * limit;

    const result: AdminUserList = await adminApi.listUsers({
      headers,
      query: { limit, offset, sortBy: filters.sort || 'createdAt' }
    });

    const userIds = result.users.map((u) => u.id);

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
      users: result.users.map((u) => toUser(u, rgMap.get(u.id) ?? null))
    };
  } catch (e) {
    mapDbError(e, 'users.getUsers');
  }
}

export async function createUser(data: UserMutationPayload) {
  try {
    const legacyRole = data.role || (data.role_group_id ? 'employee' : 'user');
    const created = await adminApi.createUser({
      body: {
        email: data.email,
        password: generateTemporaryPassword(),
        name: data.name,
        role: legacyRole
      }
    });

    const userId = created.id;

    if (data.role_group_id) {
      const { getRoleGroupById } = await import('./role-groups');
      const rg = await getRoleGroupById(data.role_group_id);
      if (rg.success) {
        await setUserRoleGroup(userId, data.role_group_id);
        const syncedRole = mapRoleGroupToLegacyRole(rg.role_group!.name);
        if (syncedRole !== legacyRole) {
          await adminApi.updateUser({
            body: { role: syncedRole },
            params: { userId }
          });
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

    const updated = await adminApi.updateUser({
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
    await adminApi.removeUser({ body: { userId: id } });
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

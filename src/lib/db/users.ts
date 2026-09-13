import { asc, eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth.server';
import { mapDbError } from '../errors';
import { db } from './index';
import { user } from './auth-schema';
import { userRoleGroups } from './schema/user-role-groups';
import { roleGroups } from './schema/role-groups';
import { mapRoleGroupToLegacyRole, setUserRoleGroup } from './role-groups';
import { buildConditions, buildOrderBy, buildPagination, buildSearchCondition } from './utils';
import type { UserFilters, UsersResponse, UserMutationPayload } from '@/lib/domain/users';
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
  }) => Promise<AdminUser | { user: AdminUser }>;
  updateUser: (opts: {
    body: {
      name?: string;
      role: string;
      banned?: boolean;
      banReason?: string;
    };
    params: { userId: string };
  }) => Promise<AdminUser>;
  setUserPassword: (opts: {
    headers: Headers;
    body: { userId: string; newPassword: string };
  }) => Promise<{ status: boolean }>;
  removeUser: (opts: { body: { userId: string } }) => Promise<{ success: boolean }>;
};

const adminApi = auth.api as unknown as AdminAuthApi;

/**
 * Flags an account for forced password rotation (one-time credential).
 * The dashboard password gate confines the session to change-password until
 * the owner sets a fresh password; the flag clears only via the verified
 * rotation in password-gate.ts. Mirrors INITIAL_LOGIN.md's bootstrap flow.
 */
async function setMustChangePassword(userId: string) {
  await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, userId));
}

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

const userSortColumnMap = {
  name: user.name,
  role: user.role,
  created_at: user.createdAt
} as const;

export async function getUsers(filters: UserFilters): Promise<UsersResponse> {
  try {
    const { limit, offset } = buildPagination(filters);

    const searchCondition = buildSearchCondition([user.name, user.email], filters.search);
    const rolesCondition = filters.roles?.trim() ? eq(user.role, filters.roles.trim()) : undefined;
    const statusCondition =
      filters.status === 'Active'
        ? eq(user.banned, false)
        : filters.status === 'Inactive'
          ? eq(user.banned, true)
          : undefined;
    const where = buildConditions([searchCondition, rolesCondition, statusCondition]);
    const orderBy = buildOrderBy(filters, userSortColumnMap) ?? asc(user.createdAt);

    const [rows, countRows] = await Promise.all([
      db.select().from(user).where(where).orderBy(orderBy).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(where)
    ]);

    const userIds = rows.map((u) => u.id);
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
      message: 'Users fetched',
      total_users: countRows[0]?.count ?? 0,
      offset,
      limit,
      users: rows.map((u) => toUser(u as unknown as AdminUser, rgMap.get(u.id) ?? null))
    };
  } catch (e) {
    mapDbError(e, 'users.getUsers');
  }
}

export async function createUser(data: UserMutationPayload) {
  try {
    const legacyRole = data.role || (data.role_group_id ? 'employee' : 'user');
    const raw = await adminApi.createUser({
      body: {
        email: data.email,
        password: data.password ?? generateTemporaryPassword(),
        name: data.name,
        role: legacyRole
      }
    });
    // Better Auth's admin createUser wraps the row as { user: AdminUser }
    // (see node_modules/better-auth/dist/plugins/admin/routes.mjs); unwrap
    // it. On an unexpected shape, look the row up by email so the rotation
    // flag (and role-group assignment) never silently skip again.
    const created: AdminUser | null =
      raw && typeof raw === 'object' && 'user' in raw
        ? (raw as { user: AdminUser }).user
        : (raw as AdminUser);
    const resolved: AdminUser | null =
      created?.id != null
        ? created
        : ((
            await db.select().from(user).where(eq(user.email, data.email.toLowerCase())).limit(1)
          ).map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role ?? legacyRole,
            banned: row.banned,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          }))[0] ?? null);
    if (!resolved) throw new Error('users.createUser: created row not found');

    const userId = resolved.id;
    await setMustChangePassword(userId);

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
        resolved.role = syncedRole;
      }
    }

    return { success: true, message: 'User created successfully', user: toUser(resolved) };
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

/**
 * Admin replacing a user's password (row action). The account is flagged for
 * forced rotation, so the new password is a one-time credential: the user is
 * confined to change-password until they set their own. Never audit the
 * password — the caller must exclude it from the audit payload.
 *
 * Unlike createUser (which tolerates a header-less server call), the admin
 * setUserPassword endpoint runs behind adminMiddleware and requires the
 * caller's session headers — forwarded here from the server function.
 */
export async function replaceUserPassword(userId: string, newPassword: string) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    await adminApi.setUserPassword({
      headers: getRequestHeaders(),
      body: { userId, newPassword }
    });
    await setMustChangePassword(userId);
    return { success: true, message: 'User password replaced successfully' };
  } catch (e) {
    mapDbError(e, 'users.replaceUserPassword');
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

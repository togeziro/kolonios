import { asc, eq, inArray, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth.server';
import { DomainError, mapDbError } from '../errors';
import { db } from './index';
import { user } from './auth-schema';
import { userRoleGroups } from './schema/user-role-groups';
import { roleGroups } from './schema/role-groups';
import { mapRoleGroupToLegacyRole, setUserRoleGroup } from './role-groups';
import { buildConditions, buildOrderBy, buildPagination, buildSearchCondition } from './utils';
import type { UserFilters, UsersResponse, UserMutationPayload } from '@/lib/domain/users';
import { generateTemporaryPassword } from '../auth/password';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

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
  /**
   * Admin plugin's `/admin/update-user` endpoint (named `adminUpdateUser`
   * server-side; `updateUser` is the core self-profile endpoint — a different
   * route that updates the session owner, not the target user). Body shape is
   * `{ userId, data }` and the row is returned unwrapped. Runs behind
   * adminMiddleware, so the caller's session headers are mandatory — without
   * them it throws APIError UNAUTHORIZED (never a validation error).
   */
  adminUpdateUser: (opts: {
    headers: Headers;
    body: {
      userId: string;
      data: Record<string, unknown>;
    };
  }) => Promise<AdminUser>;
  setUserPassword: (opts: {
    headers: Headers;
    body: { userId: string; newPassword: string };
  }) => Promise<{ status: boolean }>;
  removeUser: (opts: { headers: Headers; body: { userId: string } }) => Promise<{
    success: boolean;
  }>;
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
      // Filter in the DB — never full-scan the join table then filter in memory.
      const rgRows = await db
        .select({
          user_id: userRoleGroups.user_id,
          id: roleGroups.id,
          name: roleGroups.name
        })
        .from(userRoleGroups)
        .innerJoin(roleGroups, eq(userRoleGroups.role_group_id, roleGroups.id))
        .where(inArray(userRoleGroups.user_id, userIds));
      for (const row of rgRows) {
        rgMap.set(row.user_id, { id: row.id, name: row.name });
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
  // Tracks the created row so a failure AFTER creation can compensate
  // (delete the orphan) instead of leaving a half-provisioned account.
  let createdUserId: string | null = null;
  try {
    const legacyRole = data.role || (data.role_group_id ? 'employee' : 'user');
    // Blank admin input means "generate for me": the server creates the
    // one-time credential and returns it ONCE below — the UI shows it in a
    // copy dialog (never stored, never audited). A provided-but-weak
    // password is rejected, never silently replaced.
    const provided = data.password?.trim() || '';
    if (provided && provided.length < MIN_PASSWORD_LENGTH) {
      throw new DomainError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        'WEAK_PASSWORD'
      );
    }
    const generated = !provided;
    const initialPassword = generated ? generateTemporaryPassword() : provided;
    const raw = await adminApi.createUser({
      body: {
        email: data.email,
        password: initialPassword,
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
    createdUserId = userId;
    await setMustChangePassword(userId);

    // Carried into toUser so the create response (and its audit snapshot)
    // reflects the assigned group — the Better Auth row knows nothing of it.
    let createdRoleGroup: { id: string; name: string } | null = null;

    if (data.role_group_id) {
      const { getRoleGroupById } = await import('./role-groups');
      const rg = await getRoleGroupById(data.role_group_id);
      if (rg.success) {
        await setUserRoleGroup(userId, data.role_group_id);
        const syncedRole = mapRoleGroupToLegacyRole(rg.role_group!.name);
        if (syncedRole !== legacyRole) {
          // Same admin-middleware gate as updateUser below: the caller's
          // session headers are mandatory, otherwise Better Auth throws
          // APIError UNAUTHORIZED even though createUser itself succeeded.
          const { getRequestHeaders } = await import('@tanstack/react-start/server');
          await adminApi.adminUpdateUser({
            headers: getRequestHeaders(),
            body: { userId, data: { role: syncedRole } }
          });
        }
        resolved.role = syncedRole;
        createdRoleGroup = { id: data.role_group_id, name: rg.role_group!.name };
      }
    }

    return {
      success: true,
      message: 'User created successfully',
      user: toUser(resolved, createdRoleGroup),
      // Single-use handoff for the generated-password dialog — present only
      // when the admin left the password blank.
      ...(generated ? { generatedPassword: initialPassword } : {})
    };
  } catch (e) {
    // A failure after creation (role sync, flag, group assignment) leaves an
    // orphan account: compensate with a best-effort delete so the next retry
    // doesn't hit "user already exists". Never mask a compensation failure —
    // the original error is what the caller must see.
    if (createdUserId) {
      try {
        const { getRequestHeaders } = await import('@tanstack/react-start/server');
        await adminApi.removeUser({
          headers: getRequestHeaders(),
          body: { userId: createdUserId }
        });
      } catch (compensateError) {
        const { logger } = await import('@/lib/logger');
        logger.error(
          { userId: createdUserId, err: compensateError },
          '[db:users.createUser] orphan compensation failed'
        );
      }
    }
    mapDbError(e, 'users.createUser');
  }
}

export async function updateUser(id: string, data: UserMutationPayload) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    const headers = getRequestHeaders();

    // Resolve the role explicitly: an omitted role must preserve the current
    // row instead of downgrading to a literal default (data.role is optional
    // in UserMutationPayload and the user form doesn't even render it).
    let finalRole: string | undefined = data.role?.trim() || undefined;
    if (data.role_group_id) {
      await setUserRoleGroup(id, data.role_group_id);
      const { getRoleGroupById } = await import('./role-groups');
      const rg = await getRoleGroupById(data.role_group_id);
      if (rg.success) {
        finalRole = mapRoleGroupToLegacyRole(rg.role_group!.name);
      }
    }
    if (!finalRole) {
      const [current] = await db.select({ role: user.role }).from(user).where(eq(user.id, id));
      finalRole = current?.role ?? undefined;
    }
    if (!finalRole) {
      throw new DomainError('Cannot determine role for user update', 'ROLE_UNRESOLVED');
    }

    const updated = await adminApi.adminUpdateUser({
      headers,
      body: {
        userId: id,
        data: {
          name: data.name,
          // Better Auth requires user:set-email to change email; without it
          // this throws FORBIDDEN (never silently dropped). Non-admin role
          // groups don't hold that permission, so HR edits keep names/roles
          // only — email change is an explicit admin action.
          email: data.email,
          role: finalRole,
          ...(data.status === 'Inactive'
            ? { banned: true, banReason: 'Deactivated by admin' }
            : { banned: false, banReason: null, banExpires: null })
        }
      }
    });

    return { success: true, message: 'User updated successfully', user: toUser(updated) };
  } catch (e) {
    mapDbError(e, 'users.updateUser');
  }
}

export async function deleteUser(id: string) {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    await adminApi.removeUser({ headers: getRequestHeaders(), body: { userId: id } });
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
 * Contract: every admin endpoint runs behind adminMiddleware — always forward
 * `getRequestHeaders()`; never rely on header-less calls. (createUser is the
 * deliberate exception: Better Auth's /admin/create-user has no
 * adminMiddleware and tolerates a header-less server call.)
 */
export async function replaceUserPassword(userId: string, newPassword: string) {
  // Defense-in-depth: the service schema validates first, but direct DB
  // callers bypass it — reject weak passwords here too.
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      'WEAK_PASSWORD'
    );
  }
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

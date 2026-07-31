import { eq } from 'drizzle-orm';
import { db } from './index';
import { roleGroups } from './schema/role-groups';
import { userRoleGroups } from './schema/user-role-groups';
import { mapDbError } from '../errors';
import { generateId } from '../utils';
import type { Permissions } from './schema/role-groups';

export interface RoleGroupPayload {
  name: string;
  description: string;
  permissions: Permissions;
  is_admin: boolean;
}

function serialize(row: typeof roleGroups.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: row.permissions as Permissions,
    is_admin: row.is_admin,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}

export async function getRoleGroups() {
  try {
    const rows = await db.select().from(roleGroups).orderBy(roleGroups.name);
    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Role groups fetched',
      role_groups: rows.map(serialize),
      total: rows.length
    };
  } catch (e) {
    mapDbError(e, 'role-groups.getRoleGroups');
  }
}

export async function getRoleGroupById(id: string) {
  try {
    const rows = await db.select().from(roleGroups).where(eq(roleGroups.id, id)).limit(1);
    if (rows.length === 0) {
      return { success: false, time: new Date().toISOString(), message: 'Role group not found' };
    }
    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Role group fetched',
      role_group: serialize(rows[0])
    };
  } catch (e) {
    mapDbError(e, 'role-groups.getRoleGroupById');
  }
}

export async function createRoleGroup(data: RoleGroupPayload) {
  try {
    const existing = await db
      .select({ id: roleGroups.id })
      .from(roleGroups)
      .where(eq(roleGroups.name, data.name))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        time: new Date().toISOString(),
        message: 'Role group name already exists'
      };
    }

    const row = await db
      .insert(roleGroups)
      .values({
        id: generateId(),
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        is_admin: data.is_admin
      })
      .returning();

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Role group created',
      role_group: serialize(row[0])
    };
  } catch (e) {
    mapDbError(e, 'role-groups.createRoleGroup');
  }
}

export async function updateRoleGroup(id: string, data: RoleGroupPayload) {
  try {
    const existing = await getRoleGroupById(id);
    if (!existing.success) return existing;

    const row = await db
      .update(roleGroups)
      .set({
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        is_admin: data.is_admin,
        updated_at: new Date()
      })
      .where(eq(roleGroups.id, id))
      .returning();

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Role group updated',
      role_group: serialize(row[0])
    };
  } catch (e) {
    mapDbError(e, 'role-groups.updateRoleGroup');
  }
}

export async function deleteRoleGroup(id: string) {
  try {
    const existing = await getRoleGroupById(id);
    if (!existing.success) return existing;

    await db.delete(roleGroups).where(eq(roleGroups.id, id));
    return { success: true, time: new Date().toISOString(), message: 'Role group deleted' };
  } catch (e) {
    mapDbError(e, 'role-groups.deleteRoleGroup');
  }
}

export async function getUserRoleGroup(userId: string) {
  try {
    const rows = await db
      .select({
        role_group_id: userRoleGroups.role_group_id
      })
      .from(userRoleGroups)
      .where(eq(userRoleGroups.user_id, userId))
      .limit(1);

    if (rows.length === 0) return null;
    const result = await getRoleGroupById(rows[0].role_group_id);
    if (!result.success) return null;
    return result.role_group;
  } catch (e) {
    mapDbError(e, 'role-groups.getUserRoleGroup');
  }
}

export async function setUserRoleGroup(userId: string, roleGroupId: string) {
  try {
    await db
      .insert(userRoleGroups)
      .values({ user_id: userId, role_group_id: roleGroupId })
      .onConflictDoUpdate({
        target: userRoleGroups.user_id,
        set: { role_group_id: roleGroupId }
      });
    return {
      success: true,
      time: new Date().toISOString(),
      message: 'User assigned to role group'
    };
  } catch (e) {
    mapDbError(e, 'role-groups.setUserRoleGroup');
  }
}

const ROLE_NAME_TO_LEGACY: Record<string, string> = {
  administrator: 'admin',
  admin: 'admin',
  hr: 'hr',
  employee: 'employee',
  technician: 'technician',
  staff: 'employee',
  user: 'user',
  customer: 'user'
};

export function mapRoleGroupToLegacyRole(roleName: string): string {
  const key = roleName.toLowerCase().trim();
  return ROLE_NAME_TO_LEGACY[key] || (key ? 'employee' : 'user');
}

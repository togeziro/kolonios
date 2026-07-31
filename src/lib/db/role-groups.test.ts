import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import {
  createRoleGroup,
  getRoleGroups,
  getRoleGroupById,
  updateRoleGroup,
  deleteRoleGroup,
  setUserRoleGroup,
  getUserRoleGroup,
  mapRoleGroupToLegacyRole
} from './role-groups';
import { resetDatabase, seedUser } from '@/test-utils/db';
import { db } from '@/lib/db';
import { userRoleGroups } from './schema/user-role-groups';
import { user } from './auth-schema';
import { eq } from 'drizzle-orm';

const uid = () => 'test-' + Math.random().toString(36).slice(2, 8);

describe('role-groups data access (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('getRoleGroups returns empty array when no role groups exist', async () => {
    const result = await getRoleGroups();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.role_groups!).toEqual([]);
    expect(result.total!).toBe(0);
  });

  it('creates a role group', async () => {
    const result = await createRoleGroup({
      name: 'Technician',
      description: 'Field technician role',
      permissions: { overview: { view: true } },
      is_admin: false
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.role_group!.name).toBe('Technician');
    expect(result.role_group!.is_admin).toBe(false);
    expect(result.role_group!.permissions).toEqual({ overview: { view: true } });
  });

  it('rejects duplicate role group name', async () => {
    await createRoleGroup({
      name: 'Technician',
      description: 'First',
      permissions: {},
      is_admin: false
    });
    const result = await createRoleGroup({
      name: 'Technician',
      description: 'Second',
      permissions: {},
      is_admin: false
    });
    expect(result.success).toBe(false);
  });

  it('getRoleGroups returns all role groups', async () => {
    await createRoleGroup({
      name: 'Admin',
      description: 'Full access',
      permissions: {},
      is_admin: true
    });
    await createRoleGroup({
      name: 'Technician',
      description: 'Technician',
      permissions: {},
      is_admin: false
    });

    const result = await getRoleGroups();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.role_groups!).toHaveLength(2);
    expect(result.total!).toBe(2);
  });

  it('getRoleGroupById returns a specific role group', async () => {
    const created = await createRoleGroup({
      name: 'Technician',
      description: 'Technician',
      permissions: { customers: { view: true, add: true } },
      is_admin: false
    });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error('Expected success');
    const id = created.role_group!.id;

    const result = await getRoleGroupById(id);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.role_group!.name).toBe('Technician');
    expect(result.role_group!.permissions).toEqual({ customers: { view: true, add: true } });
  });

  it('getRoleGroupById returns failure for non-existent id', async () => {
    const result = await getRoleGroupById('non-existent-id');
    expect(result.success).toBe(false);
  });

  it('updates a role group', async () => {
    const created = await createRoleGroup({
      name: 'Technician',
      description: 'Old desc',
      permissions: {},
      is_admin: false
    });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error('Expected success');
    const id = created.role_group!.id;

    const result = await updateRoleGroup(id, {
      name: 'Technician Updated',
      description: 'New desc',
      permissions: { attendance: { view: true } },
      is_admin: true
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected success');
    expect(result.role_group!.name).toBe('Technician Updated');
    expect(result.role_group!.is_admin).toBe(true);
    expect(result.role_group!.permissions).toEqual({ attendance: { view: true } });
  });

  it('deletes a role group', async () => {
    const created = await createRoleGroup({
      name: 'Temp',
      description: 'To be deleted',
      permissions: {},
      is_admin: false
    });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error('Expected success');
    const id = created.role_group!.id;

    const result = await deleteRoleGroup(id);
    expect(result.success).toBe(true);

    const verify = await getRoleGroupById(id);
    expect(verify.success).toBe(false);
  });

  it('assigns a user to a role group and fetches it back', async () => {
    const testId = uid();
    await seedUser(testId);
    const created = await createRoleGroup({
      name: 'Technician',
      description: 'Tech',
      permissions: { attendance: { view: true } },
      is_admin: false
    });
    if (!created.success) throw new Error('Expected success');
    const rgId = created.role_group!.id;

    await setUserRoleGroup(testId, rgId);
    const group = await getUserRoleGroup(testId);
    expect(group).not.toBeNull();
    expect(group!.name).toBe('Technician');

    await db.delete(userRoleGroups).where(eq(userRoleGroups.user_id, testId));
    await db.delete(user).where(eq(user.id, testId));
  });

  it('returns null when user has no role group', async () => {
    const testId = uid();
    await seedUser(testId);
    const group = await getUserRoleGroup(testId);
    expect(group).toBeNull();

    await db.delete(user).where(eq(user.id, testId));
  });

  it('re-assigns user to a different role group', async () => {
    const testId = uid();
    await seedUser(testId);
    const tech = await createRoleGroup({
      name: 'Technician',
      description: 'Tech',
      permissions: {},
      is_admin: false
    });
    if (!tech.success) throw new Error('Expected success');

    const hr = await createRoleGroup({
      name: 'HR',
      description: 'HR',
      permissions: {},
      is_admin: false
    });
    if (!hr.success) throw new Error('Expected success');

    await setUserRoleGroup(testId, tech.role_group!.id);
    expect((await getUserRoleGroup(testId))!.name).toBe('Technician');

    await setUserRoleGroup(testId, hr.role_group!.id);
    expect((await getUserRoleGroup(testId))!.name).toBe('HR');

    await db.delete(userRoleGroups).where(eq(userRoleGroups.user_id, testId));
    await db.delete(user).where(eq(user.id, testId));
  });
});

describe('mapRoleGroupToLegacyRole', () => {
  it('maps known names to legacy roles', () => {
    expect(mapRoleGroupToLegacyRole('Administrator')).toBe('admin');
    expect(mapRoleGroupToLegacyRole('HR')).toBe('hr');
    expect(mapRoleGroupToLegacyRole('Employee')).toBe('employee');
    expect(mapRoleGroupToLegacyRole('Technician')).toBe('technician');
  });

  it('falls back to employee for custom role names', () => {
    expect(mapRoleGroupToLegacyRole('Finance')).toBe('employee');
    expect(mapRoleGroupToLegacyRole('Sales')).toBe('employee');
  });

  it('returns user for empty/unknown', () => {
    expect(mapRoleGroupToLegacyRole('')).toBe('user');
    expect(mapRoleGroupToLegacyRole('Customer')).toBe('user');
  });
});

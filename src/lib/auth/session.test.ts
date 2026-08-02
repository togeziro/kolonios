import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSessionUser = vi.hoisted(() => ({ role: 'employee' as string }));

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({ user: mockSessionUser }))
    }
  }
}));

const getRequestHeadersMock = vi.hoisted(() => vi.fn(() => new Headers()));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock
}));

const getUserRoleGroupMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/role-groups', () => ({
  getUserRoleGroup: getUserRoleGroupMock
}));

import { hasModulePermission, requirePermission, requireSession } from './session';
import { auth } from './auth.server';
import type { Permissions } from '@/features/role-groups/api/types';

const getSessionMock = vi.mocked(auth.api.getSession);

describe('requireSession', () => {
  beforeEach(() => {
    getSessionMock.mockClear();
  });

  it('returns the session when authenticated', async () => {
    const session = await requireSession();
    expect(session).toEqual({ user: mockSessionUser });
    expect(getRequestHeadersMock).toHaveBeenCalled();
  });

  it('throws when unauthenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null as never);
    await expect(requireSession()).rejects.toThrow('Unauthorized');
  });
});

describe('hasModulePermission', () => {
  const perms: Permissions = {
    products: { view: true, add: true, edit: false },
    customers: { view: true }
  };

  it('admin bypasses all checks', () => {
    expect(hasModulePermission(perms, true, 'anything', 'delete')).toBe(true);
    expect(hasModulePermission(undefined, true, 'anything', 'view')).toBe(true);
  });

  it('returns true when module action permission exists', () => {
    expect(hasModulePermission(perms, false, 'products', 'view')).toBe(true);
    expect(hasModulePermission(perms, false, 'products', 'add')).toBe(true);
    expect(hasModulePermission(perms, false, 'customers', 'view')).toBe(true);
  });

  it('returns false when action is missing or false', () => {
    expect(hasModulePermission(perms, false, 'products', 'edit')).toBe(false);
    expect(hasModulePermission(perms, false, 'products', 'delete')).toBe(false);
  });

  it('returns false when module is not in permissions', () => {
    expect(hasModulePermission(perms, false, 'users', 'view')).toBe(false);
  });

  it('returns false when permissions is undefined or empty', () => {
    expect(hasModulePermission(undefined, false, 'products', 'view')).toBe(false);
    expect(hasModulePermission({}, false, 'products', 'view')).toBe(false);
  });
});

describe('requirePermission', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSessionUser.role = 'employee';
    getUserRoleGroupMock.mockReset();
    getSessionMock.mockClear();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('passes for a role group with is_admin', async () => {
    getUserRoleGroupMock.mockResolvedValue({ is_admin: true, permissions: {} });
    await expect(requirePermission('products', 'delete')).resolves.toMatchObject({
      user: { role: 'employee' }
    });
  });

  it('passes when the role group grants the module action', async () => {
    getUserRoleGroupMock.mockResolvedValue({
      is_admin: false,
      permissions: { products: { view: true, add: true } }
    });
    await expect(requirePermission('products', 'add')).resolves.toMatchObject({
      user: { role: 'employee' }
    });
  });

  it('rejects when the role group lacks the module action', async () => {
    getUserRoleGroupMock.mockResolvedValue({
      is_admin: false,
      permissions: { products: { view: true } }
    });
    await expect(requirePermission('products', 'delete')).rejects.toThrow(
      'Forbidden: products.delete required'
    );
  });

  it('rejects when the user has no role group and is not admin', async () => {
    getUserRoleGroupMock.mockResolvedValue(null);
    await expect(requirePermission('products', 'view')).rejects.toThrow('Forbidden');
  });

  it('passes for legacy admin role without a role group (fallback with warning)', async () => {
    mockSessionUser.role = 'admin';
    getUserRoleGroupMock.mockResolvedValue(null);
    await expect(requirePermission('users', 'view')).resolves.toMatchObject({
      user: { role: 'admin' }
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith('User has admin role but no role group assignment');
  });

  it('rejects for legacy non-admin role without a role group', async () => {
    mockSessionUser.role = 'hr';
    getUserRoleGroupMock.mockResolvedValue(null);
    await expect(requirePermission('users', 'view')).rejects.toThrow('Forbidden');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  hasModulePermission,
  requireAdmin,
  requireEmployee,
  requireHR,
  requireMinRole,
  requirePermission,
  requireRole,
  requireSession,
  requireTechnician
} from './session';
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

describe('requireRole', () => {
  beforeEach(() => {
    mockSessionUser.role = 'admin';
    getSessionMock.mockClear();
  });

  it.each([
    ['admin', 'admin', true],
    ['admin', 'hr', false],
    ['hr', 'admin', true],
    ['hr', 'hr', true],
    ['hr', 'employee', false],
    ['employee', 'admin', true],
    ['employee', 'hr', true],
    ['employee', 'employee', true],
    ['employee', 'technician', false],
    ['technician', 'admin', true],
    ['technician', 'hr', true],
    ['technician', 'technician', true],
    ['technician', 'employee', false]
  ] as const)(
    'requireRole(%s) with session role %s → %s',
    async (required, sessionRole, allowed) => {
      mockSessionUser.role = sessionRole;
      if (allowed) {
        await expect(requireRole(required)).resolves.toMatchObject({ user: { role: sessionRole } });
      } else {
        await expect(requireRole(required)).rejects.toThrow('Forbidden');
      }
    }
  );
});

describe('requireMinRole', () => {
  beforeEach(() => {
    getSessionMock.mockClear();
  });

  it.each([
    ['employee', 'employee', true],
    ['employee', 'technician', true],
    ['employee', 'hr', true],
    ['employee', 'admin', true],
    ['hr', 'employee', false],
    ['hr', 'technician', false],
    ['hr', 'hr', true],
    ['hr', 'admin', true],
    ['admin', 'admin', true],
    ['admin', 'hr', false]
  ] as const)('requireMinRole(%s) with session role %s → %s', async (min, sessionRole, allowed) => {
    mockSessionUser.role = sessionRole;
    if (allowed) {
      await expect(requireMinRole(min)).resolves.toMatchObject({ user: { role: sessionRole } });
    } else {
      await expect(requireMinRole(min)).rejects.toThrow('Forbidden');
    }
  });
});

describe('requireRole edge cases', () => {
  beforeEach(() => {
    mockSessionUser.role = 'admin';
    getSessionMock.mockClear();
  });

  it('throws for unknown roles without hitting the session', async () => {
    await expect(requireRole('superuser' as never)).rejects.toThrow('Invalid role: superuser');
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});

describe('role wrappers', () => {
  beforeEach(() => {
    mockSessionUser.role = 'admin';
    getSessionMock.mockClear();
  });

  it.each([
    ['admin', requireAdmin],
    ['hr', requireHR],
    ['employee', requireEmployee],
    ['technician', requireTechnician]
  ] as const)('%s passes for an admin session', async (_name, guard) => {
    await expect(guard()).resolves.toMatchObject({ user: { role: 'admin' } });
  });

  it('requireHR rejects an employee session', async () => {
    mockSessionUser.role = 'employee';
    await expect(requireHR()).rejects.toThrow('Forbidden');
  });

  it('requireMinRole rejects an unknown session role', async () => {
    mockSessionUser.role = 'nope';
    await expect(requireMinRole('employee')).rejects.toThrow('Forbidden');
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
  beforeEach(() => {
    mockSessionUser.role = 'employee';
    getUserRoleGroupMock.mockReset();
    getSessionMock.mockClear();
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

  it('rejects when the user has no role group', async () => {
    getUserRoleGroupMock.mockResolvedValue(null);
    await expect(requirePermission('products', 'view')).rejects.toThrow('Forbidden');
  });

  it('passes for legacy admin role without a role group (fallback)', async () => {
    mockSessionUser.role = 'admin';
    getUserRoleGroupMock.mockResolvedValue(null);
    await expect(requirePermission('users', 'view')).resolves.toMatchObject({
      user: { role: 'admin' }
    });
  });

  it('rejects for legacy non-admin role without a role group', async () => {
    mockSessionUser.role = 'hr';
    getUserRoleGroupMock.mockResolvedValue(null);
    await expect(requirePermission('users', 'view')).rejects.toThrow('Forbidden');
  });
});

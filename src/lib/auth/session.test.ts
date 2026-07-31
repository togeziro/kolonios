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

import {
  requireAdmin,
  requireEmployee,
  requireHR,
  requireMinRole,
  requireRole,
  requireSession,
  requireTechnician
} from './session';
import { auth } from './auth.server';

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

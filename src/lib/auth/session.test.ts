import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSessionUser = vi.hoisted(() => ({ role: 'employee' as string }));

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({ user: mockSessionUser }))
    }
  }
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => new Headers()
}));

import { requireRole, requireMinRole } from './session';
import { auth } from './auth.server';

const getSessionMock = vi.mocked(auth.api.getSession);

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

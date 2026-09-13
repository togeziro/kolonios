import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isPasswordGateExempt } from './password-gate';

const { limitMock, updateWhereMock, requireSessionMock, changePasswordMock } = vi.hoisted(() => ({
  limitMock: vi.fn(async () => [{ flag: true }]),
  updateWhereMock: vi.fn(async () => undefined),
  requireSessionMock: vi.fn(async () => ({ user: { id: 'user-1' } })),
  changePasswordMock: vi.fn(async () => ({ user: { id: 'user-1' } }))
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: limitMock }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: updateWhereMock }))
    }))
  }
}));

vi.mock('@/lib/db/auth-schema', () => ({
  user: { id: 'id', mustChangePassword: 'mustChangePassword' }
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => args
}));

vi.mock('./session', () => ({
  requireSession: requireSessionMock
}));

vi.mock('./auth.server', () => ({
  auth: { api: { changePassword: changePasswordMock } }
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => ({ cookie: 'session=abc' })
}));

// Same server-fn test harness as features/*/api/service.test.ts: the split
// query supplies the production handler while the ssr-rpc mock funnels the
// exported caller through it, avoiding the Start server runtime.
const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator: { parse(input: unknown): unknown } | undefined;
    const builder = {
      validator(nextValidator: { parse(input: unknown): unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(...handlers: Array<(context: { data: unknown }) => unknown>) {
        const nextHandler = handlers.at(-1)!;
        const invoke = async (options: { data: unknown }) =>
          nextHandler({ data: validator ? validator.parse(options.data) : options.data });
        return Object.assign(invoke, { __executeServer: invoke });
      }
    };
    return builder;
  }
}));
vi.mock('@tanstack/react-start/server-rpc', () => ({
  createServerRpc: (_meta: unknown, fn: (options: unknown) => unknown) => fn
}));
vi.mock('@tanstack/react-start/ssr-rpc', () => ({
  createSsrRpc: () => (options: { data: unknown }) => serverFnProvider.handler!(options)
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { rotatePasswordFn_createServerFn_handler } from './password-gate?tss-serverfn-split';

serverFnProvider.handler = rotatePasswordFn_createServerFn_handler;

import { getMustChangePassword, clearMustChangePassword, rotatePasswordFn } from './password-gate';

describe('isPasswordGateExempt', () => {
  it('exempts the change-password page only', () => {
    expect(isPasswordGateExempt('/dashboard/change-password')).toBe(true);
  });

  it('treats a trailing slash as the same path', () => {
    expect(isPasswordGateExempt('/dashboard/change-password/')).toBe(true);
  });

  it('confines every other dashboard path behind the gate', () => {
    for (const path of [
      '/dashboard',
      '/dashboard/overview',
      '/dashboard/settings',
      '/dashboard/profile',
      '/dashboard/admin/storage-settings'
    ]) {
      expect(isPasswordGateExempt(path)).toBe(false);
    }
  });
});

describe('getMustChangePassword / clearMustChangePassword', () => {
  beforeEach(() => {
    limitMock.mockReset();
    limitMock.mockResolvedValue([{ flag: true }]);
    updateWhereMock.mockReset();
  });

  it('returns the stored flag for the given user', async () => {
    await expect(getMustChangePassword('user-1')).resolves.toBe(true);
    limitMock.mockResolvedValue([{ flag: false }]);
    await expect(getMustChangePassword('user-1')).resolves.toBe(false);
  });

  it('returns false when the user row is missing', async () => {
    limitMock.mockResolvedValue([]);
    await expect(getMustChangePassword('ghost')).resolves.toBe(false);
  });

  it('clears the flag via an update call', async () => {
    await clearMustChangePassword('user-1');
    expect(updateWhereMock).toHaveBeenCalled();
  });
});

describe('rotatePasswordFn', () => {
  beforeEach(() => {
    changePasswordMock.mockReset();
    changePasswordMock.mockResolvedValue({ user: { id: 'user-1' } });
    updateWhereMock.mockReset();
  });

  it('changes the password and clears the flag on success', async () => {
    const result = await rotatePasswordFn({
      data: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }
    } as never);
    expect(result).toEqual({ ok: true });
    expect(changePasswordMock).toHaveBeenCalledWith({
      headers: { cookie: 'session=abc' },
      body: {
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
        revokeOtherSessions: true
      }
    });
    expect(updateWhereMock).toHaveBeenCalled();
  });

  it('maps a rejected current password without clearing the flag', async () => {
    changePasswordMock.mockRejectedValue({ statusCode: 400, message: 'Invalid password' });
    const result = await rotatePasswordFn({
      data: { currentPassword: 'WrongPass1!', newPassword: 'NewPass1!' }
    } as never);
    expect(result).toEqual({ ok: false, code: 'WRONG_CURRENT' });
    expect(updateWhereMock).not.toHaveBeenCalled();
  });

  it('maps an unexpected failure without clearing the flag', async () => {
    changePasswordMock.mockRejectedValue({ statusCode: 500, message: 'boom' });
    const result = await rotatePasswordFn({
      data: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }
    } as never);
    expect(result).toEqual({ ok: false, code: 'GENERIC' });
    expect(updateWhereMock).not.toHaveBeenCalled();
  });
});

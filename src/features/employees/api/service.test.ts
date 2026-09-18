/**
 * Server-fn tests for `updateEmployeeFn` (business-timezone effective date)
 * plus the onboarding audit-redaction contract: `onboardEmployeeFn` and
 * `createEmployeeFn` must never write password/secret content to the audit
 * trail, on success (`employee.onboard` strips the one-time credential) or
 * failure (`employee.onboard_failed` / `employee.create_failed` carry
 * email + name + error only).
 *
 * The DB dual-write/atomicity is asserted in `src/lib/db/employees.test.ts`;
 * here we drive the production handlers through the `?tss-serverfn-split`
 * Vite provider — same approach used by `career-events.test.ts` — while
 * mocking the auth/session, audit, and DB modules.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  checkRateLimit: vi.fn(),
  withAudit: vi.fn(),
  getEmployeeById: vi.fn(),
  updateEmployee: vi.fn(),
  createEmployee: vi.fn(),
  onboardEmployee: vi.fn(),
  insertAuditRow: vi.fn()
}));

const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

vi.mock('@/lib/auth/session', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/audit', () => ({ withAudit: mocks.withAudit }));
vi.mock('@/lib/db/employees', () => ({
  getEmployeeById: mocks.getEmployeeById,
  updateEmployee: mocks.updateEmployee,
  createEmployee: mocks.createEmployee,
  onboardEmployee: mocks.onboardEmployee
}));
// The handlers import these dynamically inside their catch blocks; the real
// modules pull in server-only code (postgres driver, request headers), so
// they are stubbed here. getErrorMessage mirrors the real helper for the
// Error/object shapes used below.
vi.mock('@/lib/db/audit', () => ({ insertAuditRow: mocks.insertAuditRow }));
vi.mock('@/lib/request-id.server', () => ({ getRequestId: () => null }));
vi.mock('@/lib/errors', () => ({
  getErrorMessage: (error: unknown) =>
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : undefined
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
import { updateEmployeeFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { onboardEmployeeFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { createEmployeeFn_createServerFn_handler } from './service?tss-serverfn-split';

const EMPLOYEE = {
  id: 'emp-1',
  full_name: 'Test Employee',
  email: 'emp-1@test.com',
  birth_date: '1990-01-01',
  department_id: 1,
  designation_id: 2,
  employment_status: 'active',
  join_date: '2024-01-01'
};

const VALUES = {
  full_name: 'Test Employee',
  email: 'emp-1@test.com',
  birth_date: '1990-01-01',
  department_id: 5,
  designation_id: 6,
  employment_status: 'probation',
  join_date: '2024-01-01'
};

beforeEach(() => {
  vi.clearAllMocks();
  serverFnProvider.handler = updateEmployeeFn_createServerFn_handler;
  mocks.requirePermission.mockResolvedValue({ user: { id: 'actor-1' } });
  mocks.checkRateLimit.mockResolvedValue(undefined);
  mocks.withAudit.mockResolvedValue(undefined);
  mocks.getEmployeeById.mockResolvedValue({ success: true, employee: EMPLOYEE });
  mocks.updateEmployee.mockResolvedValue({ success: true, employee: EMPLOYEE });
});

describe('updateEmployeeFn — business-timezone effective date', () => {
  it('passes the WIB date as effectiveDate, not the UTC date, across the midnight boundary', async () => {
    // Fake only Date so the async server-fn plumbing keeps using real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2026-08-04T20:30:00Z is 2026-08-05T03:30 in Asia/Jakarta (WIB, UTC+7),
    // while new Date().toISOString().slice(0, 10) would yield '2026-08-04'.
    vi.setSystemTime(new Date('2026-08-04T20:30:00Z'));
    try {
      await serverFnProvider.handler!({ data: { id: 'emp-1', values: VALUES } });

      expect(mocks.updateEmployee).toHaveBeenCalledWith(
        'emp-1',
        expect.objectContaining({ department_id: 5, designation_id: 6 }),
        expect.objectContaining({ actorUserId: 'actor-1', effectiveDate: '2026-08-05' })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

const ONBOARD_VALUES = {
  full_name: 'Onboard Hire',
  email: 'onboard@test.com',
  birth_date: '1990-01-01',
  department_id: 1,
  designation_id: 2,
  join_date: '2024-01-01'
};

const ONBOARDED = {
  success: true,
  employee: { id: 'emp-1' },
  user: { id: 'emp-1', email: 'onboard@test.com', name: 'Onboard Hire' },
  role_group: null,
  linked: false,
  generatedPassword: 's3cret-one-time-pw'
};

// Plain-object DomainError shape (duck-typed across the server-function
// boundary): the real '@/lib/errors' module cannot load under this file's
// '@tanstack/react-start' mock, so the rejection carries code + message only.
const ALREADY_LINKED = {
  name: 'DomainError',
  code: 'EMPLOYEE_ALREADY_LINKED',
  message: 'Employee with email "onboard@test.com" is already registered'
};

describe('onboardEmployeeFn — audit redaction', () => {
  it('strips the one-time credential from the employee.onboard audit snapshot', async () => {
    mocks.onboardEmployee.mockResolvedValue(ONBOARDED);

    const res = await onboardEmployeeFn_createServerFn_handler({ data: ONBOARD_VALUES });

    expect(res).toMatchObject({ success: true });
    expect(mocks.withAudit).toHaveBeenCalledTimes(1);
    const [actor, entry] = mocks.withAudit.mock.calls[0] as [string, Record<string, unknown>];
    expect(actor).toBe('actor-1');
    expect(entry).toMatchObject({
      action: 'employee.onboard',
      entityType: 'employee',
      entityId: 'emp-1',
      before: null
    });
    // The credential lives only in the onboard response + the admin's copy
    // dialog — the audit snapshot must not contain it under any key.
    expect(entry.after).not.toHaveProperty('generatedPassword');
    expect(JSON.stringify(entry.after)).not.toContain('s3cret-one-time-pw');
  });

  it('writes employee.onboard_failed without the submitted password', async () => {
    mocks.onboardEmployee.mockRejectedValue(ALREADY_LINKED);

    await expect(
      onboardEmployeeFn_createServerFn_handler({
        data: { ...ONBOARD_VALUES, password: 'Password123!' }
      })
    ).rejects.toMatchObject({ code: 'EMPLOYEE_ALREADY_LINKED' });

    // A throw means no profile survives, but the attempt stays visible —
    // keyed by email, carrying email + name + error only.
    expect(mocks.withAudit).not.toHaveBeenCalled();
    expect(mocks.insertAuditRow).toHaveBeenCalledTimes(1);
    const row = mocks.insertAuditRow.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      action: 'employee.onboard_failed',
      entityType: 'employee',
      entityId: 'onboard@test.com'
    });
    const after = row.after as Record<string, unknown>;
    expect(Object.keys(after).sort()).toEqual(['email', 'error', 'name']);
    expect(JSON.stringify(after)).not.toContain('Password123!');
  });
});

describe('createEmployeeFn — audit redaction', () => {
  it('writes employee.create_failed with email + name + error only', async () => {
    mocks.createEmployee.mockRejectedValue(ALREADY_LINKED);

    await expect(
      createEmployeeFn_createServerFn_handler({ data: ONBOARD_VALUES })
    ).rejects.toMatchObject({ code: 'EMPLOYEE_ALREADY_LINKED' });

    expect(mocks.withAudit).not.toHaveBeenCalled();
    expect(mocks.insertAuditRow).toHaveBeenCalledTimes(1);
    const row = mocks.insertAuditRow.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      action: 'employee.create_failed',
      entityType: 'employee',
      entityId: 'onboard@test.com'
    });
    expect(Object.keys(row.after as Record<string, unknown>).sort()).toEqual([
      'email',
      'error',
      'name'
    ]);
  });
});

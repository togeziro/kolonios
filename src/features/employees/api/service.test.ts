/**
 * Server-fn tests for `updateEmployeeFn`. The DB dual-write/atomicity is
 * asserted in `src/lib/db/employees.test.ts`; here we pin the business-timezone
 * default for the Career Event effective date (WIB, not UTC) — the client
 * dialog's default is pinned separately in `-career-event-dialog.test.tsx`.
 *
 * We drive the production handler through the `?tss-serverfn-split` Vite
 * provider — same approach used by `career-events.test.ts` — while mocking the
 * auth/session, audit, and DB modules.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  checkRateLimit: vi.fn(),
  withAudit: vi.fn(),
  getEmployeeById: vi.fn(),
  updateEmployee: vi.fn()
}));

const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

vi.mock('@/lib/auth/session', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/audit', () => ({ withAudit: mocks.withAudit }));
vi.mock('@/lib/db/employees', () => ({
  getEmployeeById: mocks.getEmployeeById,
  updateEmployee: mocks.updateEmployee
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

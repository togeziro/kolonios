/**
 * Integration tests for the Opsi B write-side guards on `assignScheduleFn`
 * and `bulkAssignScheduleFn` (attendance feature).
 *
 * Drives the production server-fn handlers via the `?tss-serverfn-split`
 * TanStack Start provider, with `@/lib/auth/session`, `@/lib/rate-limit`,
 * and `@/lib/audit` mocked so each handler runs against the actual test DB
 * without a real session. Pattern mirrors
 * `src/features/schedule-grid/api/write-service.integration.test.ts`.
 *
 * Repo convention: the cross-field rule `effectiveTo > effectiveFrom` lives
 * in the server fn (NOT in zod) and surfaces as the tuple
 * `{ success: false, error: 'effectiveToBeforeFrom' }`, matching
 * `createAssignmentInlineFn`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetAllTables, seedShift } from '@/test-utils/db';
import { db } from '@/lib/db';
import { scheduleAssignments } from '@/lib/db/schema/attendance';

const sessionUser = vi.hoisted(() => ({
  id: 'attendance-assign-test-admin',
  role: 'admin',
  permissions: { attendance_admin: { edit: true } }
}));
const requirePermissionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const checkRateLimitMock = vi.hoisted(() => vi.fn(async () => undefined));
const withAuditMock = vi.hoisted(() =>
  vi.fn(async (_actor: unknown, _e: unknown, fn: () => Promise<unknown>) => fn())
);

const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

const createServerFnMock = vi.hoisted(() => {
  return () => {
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
  };
});

vi.mock('@tanstack/react-start', () => ({
  createServerFn: createServerFnMock
}));

vi.mock('@tanstack/react-start/server-rpc', () => ({
  createServerRpc: (_meta: unknown, fn: (options: unknown) => unknown) => fn
}));

vi.mock('@tanstack/react-start/ssr-rpc', () => ({
  createSsrRpc: () => (options: { data: unknown }) => serverFnProvider.handler!(options)
}));

vi.mock('@/lib/auth/auth.server', () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: sessionUser })) } }
}));

vi.mock('@/lib/auth/session', () => ({
  requirePermission: requirePermissionMock
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock
}));

vi.mock('@/lib/audit', () => ({
  withAudit: withAuditMock
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { assignScheduleFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { bulkAssignScheduleFn_createServerFn_handler } from './service?tss-serverfn-split';

const TEST_USER_ID = 'attendance-assign-test-user';

async function countAssignments(userId: string) {
  return db.select().from(scheduleAssignments).where(eq(scheduleAssignments.user_id, userId));
}

describe('attendance assignment server fns — inverted-range guards (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    withAuditMock.mockClear();
    await seedShift({ id: 1, name: 'Morning' });
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('assignScheduleFn', () => {
    beforeEach(() => {
      serverFnProvider.handler = assignScheduleFn_createServerFn_handler;
    });

    it("rejects effectiveTo <= effectiveFrom with the 'effectiveToBeforeFrom' tuple", async () => {
      for (const effectiveTo of ['2026-09-08', '2026-09-01']) {
        const res = (await serverFnProvider.handler!({
          data: {
            userId: TEST_USER_ID,
            shiftId: 1,
            effectiveFrom: '2026-09-08',
            effectiveTo
          }
        })) as { success: boolean; error?: string };

        expect(res.success).toBe(false);
        expect(res.error).toBe('effectiveToBeforeFrom');
      }
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
      expect(withAuditMock).not.toHaveBeenCalled();
    });

    it('accepts a valid bounded range', async () => {
      const bounded = (await serverFnProvider.handler!({
        data: {
          userId: TEST_USER_ID,
          shiftId: 1,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-09-30'
        }
      })) as { success: boolean };

      expect(bounded.success).toBe(true);
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(1);
      expect(withAuditMock).toHaveBeenCalledTimes(1);
    });

    it("rejects a missing effectiveTo with the 'effectiveToRequired' tuple", async () => {
      for (const data of [
        { userId: TEST_USER_ID, shiftId: 1, effectiveFrom: '2026-10-01' },
        { userId: TEST_USER_ID, shiftId: 1, effectiveFrom: '2026-10-01', effectiveTo: null }
      ]) {
        const res = (await serverFnProvider.handler!({ data })) as {
          success: boolean;
          error?: string;
        };

        expect(res.success).toBe(false);
        expect(res.error).toBe('effectiveToRequired');
      }
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
      expect(withAuditMock).not.toHaveBeenCalled();
    });
  });

  describe('bulkAssignScheduleFn', () => {
    beforeEach(() => {
      serverFnProvider.handler = bulkAssignScheduleFn_createServerFn_handler;
    });

    it('rejects the whole batch when one entry is inverted (nothing written)', async () => {
      const res = (await serverFnProvider.handler!({
        data: {
          assignments: [
            {
              userId: TEST_USER_ID,
              shiftId: 1,
              effectiveFrom: '2026-09-01',
              effectiveTo: '2026-09-30'
            },
            {
              userId: TEST_USER_ID,
              shiftId: 1,
              effectiveFrom: '2026-09-14',
              effectiveTo: '2026-09-07'
            }
          ]
        }
      })) as { success: boolean; error?: string };

      expect(res.success).toBe(false);
      expect(res.error).toBe('effectiveToBeforeFrom');
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
      expect(withAuditMock).not.toHaveBeenCalled();
    });

    it('rejects the whole batch when one entry is missing effectiveTo (nothing written)', async () => {
      const res = (await serverFnProvider.handler!({
        data: {
          assignments: [
            {
              userId: TEST_USER_ID,
              shiftId: 1,
              effectiveFrom: '2026-09-01',
              effectiveTo: '2026-09-30'
            },
            { userId: TEST_USER_ID, shiftId: 1, effectiveFrom: '2026-10-01' }
          ]
        }
      })) as { success: boolean; error?: string };

      expect(res.success).toBe(false);
      expect(res.error).toBe('effectiveToRequired');
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
      expect(withAuditMock).not.toHaveBeenCalled();
    });

    it('accepts an all-valid batch', async () => {
      const res = (await serverFnProvider.handler!({
        data: {
          assignments: [
            {
              userId: TEST_USER_ID,
              shiftId: 1,
              effectiveFrom: '2026-09-01',
              effectiveTo: '2026-09-30'
            },
            {
              userId: TEST_USER_ID,
              shiftId: 1,
              effectiveFrom: '2026-10-01',
              effectiveTo: '2026-10-31'
            }
          ]
        }
      })) as { success: boolean; count?: number };

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(2);
    });
  });
});

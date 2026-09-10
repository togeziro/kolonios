/**
 * Server-fn unit tests for `appendCareerEventFn`. The dual-write contract
 * is asserted at the DB layer in `career-timeline.test.ts`; here we pin
 * the permission guard (employees.edit) and the per-category payload
 * branching.
 *
 * We drive the production handler through the `?tss-serverfn-split`
 * Vite provider — same approach used in schedule-grid's import-service
 * integration test — so the validation, permission check, and DB call
 * all run in the same path as production.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetAllTables,
  seedEmployee,
  seedDepartment,
  seedDesignation,
  seedUser
} from '@/test-utils/db';

const sessionUser = vi.hoisted(() => ({
  id: 'career-event-test-actor',
  role: 'admin',
  permissions: { employees: { edit: true } }
}));
const requirePermissionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const checkRateLimitMock = vi.hoisted(() => vi.fn(async () => undefined));

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
          nextHandler({
            data: validator ? validator.parse(options.data) : options.data
          });
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

vi.mock('@/lib/auth/session', () => ({
  requirePermission: requirePermissionMock
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { appendCareerEventFn_createServerFn_handler } from './career-events?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { deleteCareerEventFn_createServerFn_handler } from './career-events?tss-serverfn-split';
import { db } from '@/lib/db';
import { employeeCareerEvents } from '@/lib/db/schema/employee-career-events';
import { employees } from '@/lib/db/schema/employees';
import { eq, sql } from 'drizzle-orm';

beforeEach(async () => {
  await resetAllTables();
  // Seed the actor user (FK target for employee_career_events.actor_user_id).
  await seedUser(sessionUser.id, { role: 'admin' });
  serverFnProvider.handler = appendCareerEventFn_createServerFn_handler;
  requirePermissionMock.mockReset();
  requirePermissionMock.mockResolvedValue({ user: sessionUser });
  checkRateLimitMock.mockReset();
  checkRateLimitMock.mockResolvedValue(undefined);
});

afterAll(async () => {
  await resetAllTables();
});

async function seedOneEmployeeWithSecondDesignation() {
  const emp = await seedEmployee('career-event-test-emp');
  const otherDept = await seedDepartment({ code: 'OTHER', name: 'Field Services' });
  const otherDesig = await seedDesignation(otherDept.id, {
    code: 'OTHER-DSG',
    name: 'Senior Engineer'
  });
  return { employee: emp, otherDept, otherDesig };
}

describe('appendCareerEventFn — permission guard', () => {
  it('rejects the request when requirePermission throws Forbidden', async () => {
    requirePermissionMock.mockRejectedValueOnce(new Error('Forbidden: employees.edit required'));

    await expect(
      serverFnProvider.handler!({
        data: {
          category: 'position',
          employeeId: 'career-event-test-emp',
          toDesignationId: 7,
          effectiveDate: '2026-05-01',
          notes: null
        }
      })
    ).rejects.toThrow(/Forbidden/);

    expect(requirePermissionMock).toHaveBeenCalledWith('employees', 'edit');

    // No event row was written.
    const events = await db
      .select()
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.employee_id, 'career-event-test-emp'));
    expect(events).toHaveLength(0);
  });

  it('succeeds when the caller has employees.edit (position event)', async () => {
    const { otherDesig } = await seedOneEmployeeWithSecondDesignation();

    const result = (await serverFnProvider.handler!({
      data: {
        category: 'position',
        employeeId: 'career-event-test-emp',
        toDesignationId: otherDesig.id,
        effectiveDate: '2026-05-01',
        notes: 'Promoted'
      }
    })) as { to_label: string; category: string };

    expect(result).toMatchObject({
      category: 'position',
      to_label: 'Senior Engineer'
    });
    expect(requirePermissionMock).toHaveBeenCalledWith('employees', 'edit');
  });
});

describe('appendCareerEventFn — payload branching', () => {
  it('appends a division event and updates the employee column', async () => {
    const { otherDept } = await seedOneEmployeeWithSecondDesignation();

    await serverFnProvider.handler!({
      data: {
        category: 'division',
        employeeId: 'career-event-test-emp',
        toDepartmentId: otherDept.id,
        effectiveDate: '2026-06-15',
        notes: null
      }
    });

    const [emp] = await db
      .select({ department_id: employees.department_id })
      .from(employees)
      .where(eq(employees.id, 'career-event-test-emp'))
      .limit(1);
    expect(emp?.department_id).toBe(otherDept.id);

    const events = await db
      .select()
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.employee_id, 'career-event-test-emp'));
    expect(events).toHaveLength(1);
    expect(events[0]?.category).toBe('division');
    expect(events[0]?.to_label).toBe('Field Services');
  });

  it('appends an employment_status event and updates the employee column', async () => {
    await seedEmployee('career-event-test-emp');

    await serverFnProvider.handler!({
      data: {
        category: 'employment_status',
        employeeId: 'career-event-test-emp',
        toLabel: 'probation',
        effectiveDate: '2026-07-01',
        notes: null
      }
    });

    const [emp] = await db
      .select({ employment_status: employees.employment_status })
      .from(employees)
      .where(eq(employees.id, 'career-event-test-emp'))
      .limit(1);
    expect(emp?.employment_status).toBe('probation');

    const events = await db
      .select()
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.employee_id, 'career-event-test-emp'));
    expect(events).toHaveLength(1);
    expect(events[0]?.category).toBe('employment_status');
    expect(events[0]?.to_label).toBe('probation');
  });
});

describe('deleteCareerEventFn — guards', () => {
  async function seedCareerEvent(
    overrides: Partial<typeof employeeCareerEvents.$inferInsert> = {}
  ) {
    const [row] = await db
      .insert(employeeCareerEvents)
      .values({
        employee_id: 'career-event-test-emp',
        category: 'position',
        effective_date: '2026-01-15',
        from_label: null,
        to_label: 'Engineer',
        actor_user_id: sessionUser.id,
        ...overrides
      })
      .returning();
    if (!row) throw new Error('seedCareerEvent failed to insert');
    return row;
  }

  it('rejects the request when requirePermission throws Forbidden', async () => {
    serverFnProvider.handler = deleteCareerEventFn_createServerFn_handler;
    requirePermissionMock.mockRejectedValueOnce(new Error('Forbidden: employees.edit required'));

    await expect(serverFnProvider.handler!({ data: { eventId: 1 } })).rejects.toThrow(/Forbidden/);

    expect(requirePermissionMock).toHaveBeenCalledWith('employees', 'edit');
  });

  it('deletes a fresh event recorded by the current user', async () => {
    serverFnProvider.handler = deleteCareerEventFn_createServerFn_handler;
    await seedEmployee('career-event-test-emp');
    const seeded = await seedCareerEvent();

    const result = (await serverFnProvider.handler!({ data: { eventId: seeded.id } })) as {
      id: number;
    };

    expect(result).toEqual({ id: seeded.id });
    const rows = await db
      .select()
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.id, seeded.id));
    expect(rows).toHaveLength(0);
  });

  it('rejects an event older than 5 minutes with CAREER_EVENT_DELETE_FORBIDDEN', async () => {
    serverFnProvider.handler = deleteCareerEventFn_createServerFn_handler;
    await seedEmployee('career-event-test-emp');
    const seeded = await seedCareerEvent();
    // Age the row with the DB clock: the guard compares against `now()` in SQL.
    await db.execute(
      sql`UPDATE employee_career_events SET created_at = now() - interval '6 minutes' WHERE id = ${seeded.id}`
    );

    await expect(serverFnProvider.handler!({ data: { eventId: seeded.id } })).rejects.toMatchObject(
      { code: 'CAREER_EVENT_DELETE_FORBIDDEN' }
    );
  });
});

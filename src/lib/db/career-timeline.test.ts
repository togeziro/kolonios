import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { employeeCareerEvents, type NewCareerEvent } from '@/lib/db/schema/employee-career-events';
import { employees } from '@/lib/db/schema/employees';
import { designations, departments } from '@/lib/db/schema/masterdata';
import { resetAllTables, seedEmployee, seedUser } from '@/test-utils/db';
import {
  appendCareerEvent,
  backfillStartWorkEvents,
  deleteCareerEvent,
  findCareerEventsFor,
  listCareerEventsForEmployee,
  CAREER_EVENT_DELETE_FORBIDDEN
} from './career-timeline';

const EMP_A = 'emp-career-a';
const EMP_B = 'emp-career-b';
const ACTOR = 'emp-career-actor';

async function seedEvent(
  overrides: Partial<NewCareerEvent> & Pick<NewCareerEvent, 'employee_id'>
): Promise<{ id: number; effective_date: string }> {
  const [row] = await db
    .insert(employeeCareerEvents)
    .values({
      category: 'position',
      effective_date: '2026-01-15',
      notes: null,
      actor_user_id: null,
      from_designation_id: null,
      to_designation_id: null,
      from_department_id: null,
      to_department_id: null,
      from_label: null,
      to_label: 'Field Services Engineer',
      ...overrides
    })
    .returning({
      id: employeeCareerEvents.id,
      effective_date: employeeCareerEvents.effective_date
    });
  if (!row) throw new Error('seedEvent failed to insert');
  return row;
}

/**
 * Move an event's `created_at` into the past using the DATABASE clock. The
 * delete guard compares against `now()` in SQL, and `created_at` is normally
 * written by the `defaultNow()` default in the same session — so the window
 * tests must age rows with the DB clock too, not a JS `Date` (which would be a
 * different wall-clock convention on a non-UTC session).
 */
async function backdateEvent(id: number, minutesAgo: number): Promise<void> {
  await db.execute(
    sql`UPDATE ${employeeCareerEvents} SET created_at = now() - (${minutesAgo} * interval '1 minute') WHERE id = ${id}`
  );
}

describe('listCareerEventsForEmployee', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedUser(ACTOR);
    await seedEmployee(EMP_A);
    await seedEmployee(EMP_B);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('returns events for one employee only', async () => {
    await seedEvent({ employee_id: EMP_A, effective_date: '2026-03-01' });
    await seedEvent({ employee_id: EMP_A, effective_date: '2026-04-01' });
    await seedEvent({ employee_id: EMP_B, effective_date: '2026-05-01' });

    const rows = await listCareerEventsForEmployee(EMP_A);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.employee_id).toBe(EMP_A);
    }
  });

  it('orders by effective_date DESC (newest first)', async () => {
    await seedEvent({ employee_id: EMP_A, effective_date: '2026-01-10' });
    await seedEvent({ employee_id: EMP_A, effective_date: '2026-03-15' });
    await seedEvent({ employee_id: EMP_A, effective_date: '2026-02-20' });

    const rows = await listCareerEventsForEmployee(EMP_A);
    expect(rows.map((r) => r.effective_date)).toEqual(['2026-03-15', '2026-02-20', '2026-01-10']);
  });

  it('uses id DESC as the deterministic tie-breaker when effective_date is equal', async () => {
    const first = await seedEvent({ employee_id: EMP_A, effective_date: '2026-03-15' });
    const second = await seedEvent({ employee_id: EMP_A, effective_date: '2026-03-15' });
    const third = await seedEvent({ employee_id: EMP_A, effective_date: '2026-03-15' });

    const rows = await listCareerEventsForEmployee(EMP_A);
    expect(rows.map((r) => r.id)).toEqual([third.id, second.id, first.id]);
  });

  it('returns an empty array for an employee with no events', async () => {
    expect(await listCareerEventsForEmployee(EMP_A)).toEqual([]);
  });

  it('returns an empty array for an unknown employee id', async () => {
    expect(await listCareerEventsForEmployee('does-not-exist')).toEqual([]);
  });

  it('exposes the column shape the API contract expects', async () => {
    const seeded = await seedEvent({
      employee_id: EMP_A,
      effective_date: '2026-04-01',
      category: 'position',
      to_label: 'Senior Engineer',
      from_label: 'Engineer',
      notes: 'Promoted after Q2 review',
      actor_user_id: ACTOR
    });

    const [row] = await listCareerEventsForEmployee(EMP_A);
    expect(row).toMatchObject({
      id: seeded.id,
      employee_id: EMP_A,
      category: 'position',
      effective_date: '2026-04-01',
      from_label: 'Engineer',
      to_label: 'Senior Engineer',
      notes: 'Promoted after Q2 review',
      actor_user_id: ACTOR
    });
    expect(row).toHaveProperty('created_at');
    expect(row).toHaveProperty('updated_at');
  });
});

describe('seed idempotency at the data layer', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedEmployee(EMP_A);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  async function startWorkCount() {
    const rows = await db
      .select()
      .from(employeeCareerEvents)
      .where(
        and(
          eq(employeeCareerEvents.employee_id, EMP_A),
          eq(employeeCareerEvents.category, 'start_work')
        )
      );
    return rows;
  }

  it('produces exactly one start_work event the first time the seed runs', async () => {
    await backfillStartWorkEvents(db);
    expect(await startWorkCount()).toHaveLength(1);
  });

  it('still produces exactly one start_work event when the seed runs again (idempotent)', async () => {
    await backfillStartWorkEvents(db);
    await backfillStartWorkEvents(db);
    await backfillStartWorkEvents(db);
    expect(await startWorkCount()).toHaveLength(1);
  });

  it('sourced the effective_date from employees.join_date', async () => {
    await backfillStartWorkEvents(db);
    const [row] = await startWorkCount();
    expect(row?.effective_date).toBe('2024-01-01'); // default in seedEmployee
  });

  it('cascade-deletes events when the employee is deleted', async () => {
    await backfillStartWorkEvents(db);
    expect(await startWorkCount()).toHaveLength(1);

    await db.delete(employees).where(eq(employees.id, EMP_A));
    const rows = await db
      .select()
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.employee_id, EMP_A));
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// appendCareerEvent — dual-write transaction helper
// ---------------------------------------------------------------------------
//
// The dual-write contract is: one DB call produces both an
// employee_career_events row AND the matching column update on employees.
// Both succeed or both roll back. The dialog path and the legacy edit path
// call this same helper; the regression test verifies the "exactly one
// matching event per mutation" guarantee on BOTH paths.

describe('appendCareerEvent', () => {
  let fromDesignationId: number;
  let toDesignationId: number;
  let fromDepartmentId: number;
  let toDepartmentId: number;

  beforeEach(async () => {
    await resetAllTables();
    await seedUser(ACTOR);
    await seedEmployee(EMP_A);

    // Re-read the seeded employee to grab the auto-generated FKs.
    const [emp] = await db
      .select({
        designation_id: employees.designation_id,
        department_id: employees.department_id
      })
      .from(employees)
      .where(eq(employees.id, EMP_A))
      .limit(1);
    if (!emp) throw new Error('seedEmployee failed to insert');
    fromDesignationId = emp.designation_id;
    fromDepartmentId = emp.department_id;

    // Make a second department + designation in the same department so we
    // can move laterally without violating any FK uniqueness.
    const [newDept] = await db
      .insert(departments)
      .values({ name: 'Field Services', code: 'FIELD', is_active: true })
      .returning();
    if (!newDept) throw new Error('insert department failed');
    toDepartmentId = newDept.id;

    const [newDesig] = await db
      .insert(designations)
      .values({
        name: 'Field Services Engineer',
        code: 'FSE',
        department_id: newDept.id,
        is_active: true
      })
      .returning();
    if (!newDesig) throw new Error('insert designation failed');
    toDesignationId = newDesig.id;
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('appends a position event AND updates employees.designation_id atomically', async () => {
    const inserted = await appendCareerEvent({
      category: 'position',
      employeeId: EMP_A,
      toDesignationId,
      effectiveDate: '2026-05-01',
      notes: 'Promoted after Q2 review',
      actorUserId: ACTOR
    });

    expect(inserted).toMatchObject({
      employee_id: EMP_A,
      category: 'position',
      effective_date: '2026-05-01',
      notes: 'Promoted after Q2 review',
      actor_user_id: ACTOR,
      from_designation_id: fromDesignationId,
      to_designation_id: toDesignationId,
      from_label: 'Developer',
      to_label: 'Field Services Engineer'
    });
    expect(inserted.from_department_id).toBeNull();
    expect(inserted.to_department_id).toBeNull();

    const [updatedEmployee] = await db
      .select({ designation_id: employees.designation_id })
      .from(employees)
      .where(eq(employees.id, EMP_A))
      .limit(1);
    expect(updatedEmployee?.designation_id).toBe(toDesignationId);
  });

  it('appends a division event AND updates employees.department_id atomically', async () => {
    const inserted = await appendCareerEvent({
      category: 'division',
      employeeId: EMP_A,
      toDepartmentId,
      effectiveDate: '2026-06-15',
      notes: null,
      actorUserId: ACTOR
    });

    expect(inserted).toMatchObject({
      employee_id: EMP_A,
      category: 'division',
      effective_date: '2026-06-15',
      from_department_id: fromDepartmentId,
      to_department_id: toDepartmentId,
      from_label: 'Engineering',
      to_label: 'Field Services'
    });
    expect(inserted.from_designation_id).toBeNull();
    expect(inserted.to_designation_id).toBeNull();

    const [updatedEmployee] = await db
      .select({ department_id: employees.department_id })
      .from(employees)
      .where(eq(employees.id, EMP_A))
      .limit(1);
    expect(updatedEmployee?.department_id).toBe(toDepartmentId);
  });

  it('appends an employment_status event AND updates employees.employment_status atomically', async () => {
    const inserted = await appendCareerEvent({
      category: 'employment_status',
      employeeId: EMP_A,
      toLabel: 'probation',
      effectiveDate: '2026-07-01',
      notes: null,
      actorUserId: ACTOR
    });

    expect(inserted).toMatchObject({
      category: 'employment_status',
      to_label: 'probation',
      from_label: 'active'
    });
    expect(inserted.from_designation_id).toBeNull();
    expect(inserted.to_designation_id).toBeNull();
    expect(inserted.from_department_id).toBeNull();
    expect(inserted.to_department_id).toBeNull();

    const [updatedEmployee] = await db
      .select({ employment_status: employees.employment_status })
      .from(employees)
      .where(eq(employees.id, EMP_A))
      .limit(1);
    expect(updatedEmployee?.employment_status).toBe('probation');
  });

  it('produces exactly one matching employee_career_events row per successful mutation (regression)', async () => {
    await appendCareerEvent({
      category: 'position',
      employeeId: EMP_A,
      toDesignationId,
      effectiveDate: '2026-05-01',
      notes: null,
      actorUserId: ACTOR
    });

    const matches = await findCareerEventsFor(EMP_A, {
      category: 'position',
      toDesignationId
    });
    expect(matches).toHaveLength(1);
  });

  it('rolls back the event insert when the employee update throws (transaction contract)', async () => {
    // The ticket explicitly requires forcing the SECOND write (the employees
    // update) to throw and asserting that NEITHER write persists. The event
    // insert has no FK to the employee column, so the only faithful way to
    // force the update to fail is to make the transaction's `update` throw
    // after the insert has already succeeded inside the same transaction.
    const before = await db
      .select({
        department_id: employees.department_id,
        designation_id: employees.designation_id,
        employment_status: employees.employment_status
      })
      .from(employees)
      .where(eq(employees.id, EMP_A))
      .limit(1);
    expect(before).toHaveLength(1);
    expect(await listCareerEventsForEmployee(EMP_A)).toHaveLength(0);

    const originalTransaction = db.transaction.bind(db);
    const failingTransaction = (async (callback: Parameters<typeof db.transaction>[0]) =>
      originalTransaction(async (tx) => {
        // Keep the SELECT + INSERT working; make the employee UPDATE throw.
        (tx as { update: unknown }).update = () => {
          throw new Error('forced employee update failure');
        };
        return callback(tx);
      })) as typeof db.transaction;

    db.transaction = failingTransaction;
    try {
      await expect(
        appendCareerEvent({
          category: 'position',
          employeeId: EMP_A,
          toDesignationId,
          effectiveDate: '2026-05-01',
          notes: null,
          actorUserId: ACTOR
        })
      ).rejects.toThrow();
    } finally {
      db.transaction = originalTransaction;
    }

    // Both writes rolled back: the event insert (which succeeded before the
    // update threw) is gone, and the employee columns are untouched.
    expect(await listCareerEventsForEmployee(EMP_A)).toHaveLength(0);
    const [after] = await db
      .select({
        designation_id: employees.designation_id,
        department_id: employees.department_id,
        employment_status: employees.employment_status
      })
      .from(employees)
      .where(eq(employees.id, EMP_A))
      .limit(1);
    expect(after).toEqual(before[0]);
  });

  it('rejects a position append whose toDesignationId does not exist', async () => {
    await expect(
      appendCareerEvent({
        category: 'position',
        employeeId: EMP_A,
        toDesignationId: 999_999,
        effectiveDate: '2026-05-01',
        notes: null,
        actorUserId: ACTOR
      })
    ).rejects.toThrow();

    // No half-state: neither the employees row nor any event row changed.
    expect(await listCareerEventsForEmployee(EMP_A)).toHaveLength(0);
  });

  it('rejects a division append whose toDepartmentId does not exist', async () => {
    await expect(
      appendCareerEvent({
        category: 'division',
        employeeId: EMP_A,
        toDepartmentId: 999_999,
        effectiveDate: '2026-06-15',
        notes: null,
        actorUserId: ACTOR
      })
    ).rejects.toThrow();

    expect(await listCareerEventsForEmployee(EMP_A)).toHaveLength(0);
  });

  it('rejects an unknown employeeId without touching either table', async () => {
    await expect(
      appendCareerEvent({
        category: 'position',
        employeeId: 'does-not-exist',
        toDesignationId,
        effectiveDate: '2026-05-01',
        notes: null,
        actorUserId: ACTOR
      })
    ).rejects.toThrow();

    expect(await listCareerEventsForEmployee('does-not-exist')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deleteCareerEvent — 5-minute correction window + same-actor guard
// ---------------------------------------------------------------------------
//
// Hard delete is allowed ONLY when the event was recorded by the caller within
// the last 5 minutes. Every other path is rejected with
// CAREER_EVENT_DELETE_FORBIDDEN (system-seeded rows have a NULL actor and are
// therefore undeletable). Deleting an event must never touch the matching
// `employees` column.

describe('deleteCareerEvent', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedUser(ACTOR);
    await seedEmployee(EMP_A);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  async function eventById(id: number) {
    const [row] = await db
      .select()
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.id, id));
    return row;
  }

  it('deletes a fresh event recorded by the same actor', async () => {
    const seeded = await seedEvent({ employee_id: EMP_A, actor_user_id: ACTOR });

    const result = await deleteCareerEvent(seeded.id, ACTOR);

    expect(result).toEqual({ id: seeded.id });
    expect(await eventById(seeded.id)).toBeUndefined();
  });

  it('allows deletion inside the 5-minute window', async () => {
    const seeded = await seedEvent({ employee_id: EMP_A, actor_user_id: ACTOR });
    await backdateEvent(seeded.id, 4);

    await expect(deleteCareerEvent(seeded.id, ACTOR)).resolves.toEqual({ id: seeded.id });
    expect(await eventById(seeded.id)).toBeUndefined();
  });

  it('rejects an event created more than 5 minutes ago and keeps the row', async () => {
    const seeded = await seedEvent({ employee_id: EMP_A, actor_user_id: ACTOR });
    await backdateEvent(seeded.id, 6);

    await expect(deleteCareerEvent(seeded.id, ACTOR)).rejects.toMatchObject({
      code: CAREER_EVENT_DELETE_FORBIDDEN
    });
    expect(await eventById(seeded.id)).toBeDefined();
  });

  it('rejects an event recorded by a different actor', async () => {
    const seeded = await seedEvent({ employee_id: EMP_A, actor_user_id: ACTOR });

    await expect(deleteCareerEvent(seeded.id, 'someone-else')).rejects.toMatchObject({
      code: CAREER_EVENT_DELETE_FORBIDDEN
    });
    expect(await eventById(seeded.id)).toBeDefined();
  });

  it('rejects a system-seeded event whose actor is NULL', async () => {
    const seeded = await seedEvent({ employee_id: EMP_A, actor_user_id: null });

    await expect(deleteCareerEvent(seeded.id, ACTOR)).rejects.toMatchObject({
      code: CAREER_EVENT_DELETE_FORBIDDEN
    });
    expect(await eventById(seeded.id)).toBeDefined();
  });

  it('rejects a missing event', async () => {
    await expect(deleteCareerEvent(999_999, ACTOR)).rejects.toMatchObject({
      code: CAREER_EVENT_DELETE_FORBIDDEN
    });
  });

  it('does NOT revert the employees column when the event is deleted', async () => {
    const [newDept] = await db
      .insert(departments)
      .values({ name: 'Field Services', code: 'FIELD', is_active: true })
      .returning();
    if (!newDept) throw new Error('insert department failed');
    const [newDesig] = await db
      .insert(designations)
      .values({
        name: 'Field Services Engineer',
        code: 'FSE',
        department_id: newDept.id,
        is_active: true
      })
      .returning();
    if (!newDesig) throw new Error('insert designation failed');

    const seeded = await seedEvent({
      employee_id: EMP_A,
      actor_user_id: ACTOR,
      category: 'position',
      to_designation_id: newDesig.id
    });
    // Simulate the append path's column update.
    await db.update(employees).set({ designation_id: newDesig.id }).where(eq(employees.id, EMP_A));

    await deleteCareerEvent(seeded.id, ACTOR);

    const [emp] = await db
      .select({ designation_id: employees.designation_id })
      .from(employees)
      .where(eq(employees.id, EMP_A))
      .limit(1);
    expect(emp?.designation_id).toBe(newDesig.id);
  });
});

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './index';
import { DomainError, mapDbError } from '../errors';
import { employeeCareerEvents, type CareerEvent } from './schema/employee-career-events';
import { employees } from './schema/employees';
import { designations, departments } from './schema/masterdata';

// Read + dual-write access for the Career Timeline. The single `appendCareerEvent`
// helper is the only place that writes both the employee column AND the matching
// employee_career_events row, so the legacy edit form and the Career Timeline
// dialog share one code path (ADR-0007).

/**
 * List every Career Event for one employee, ordered newest-first by
 * `effective_date` (the canonical "when did this happen" date — see
 * ADR-0008), with `id DESC` as the deterministic tie-breaker so the UI
 * does not flicker on rows that share an effective date (typical for
 * seed-backfilled `start_work` events with synthetic ids).
 *
 * Returns an empty array if the employee has no events (or does not
 * exist) — the timeline UI treats "no events" and "unknown employee"
 * the same way (an empty timeline).
 */
export async function listCareerEventsForEmployee(employeeId: string): Promise<CareerEvent[]> {
  try {
    return await db
      .select()
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.employee_id, employeeId))
      .orderBy(desc(employeeCareerEvents.effective_date), desc(employeeCareerEvents.id));
  } catch (e) {
    mapDbError(e, 'careerTimeline.listCareerEventsForEmployee');
  }
}

// --- Dual-write payload -------------------------------------------------------

/**
 * Wire-shape payload the server-fn layer accepts. Per category the caller
 * supplies either an FK id (position / division) or a free-text label
 * (employment_status). The `from_*` fields and `to_label` for the FK
 * categories are resolved here from the employee's current state and the
 * target row — the dialog does not send them.
 */
export type AppendCareerEventInput =
  | {
      category: 'position';
      employeeId: string;
      toDesignationId: number;
      effectiveDate: string;
      notes: string | null;
      actorUserId: string;
    }
  | {
      category: 'division';
      employeeId: string;
      toDepartmentId: number;
      effectiveDate: string;
      notes: string | null;
      actorUserId: string;
    }
  | {
      category: 'employment_status';
      employeeId: string;
      toLabel: string;
      effectiveDate: string;
      notes: string | null;
      actorUserId: string;
    };

export type AppendCareerEventResult = CareerEvent;

/**
 * Drizzle transaction handle. Derived from `db.transaction` so the helper
 * signature stays in lock-step with the driver and callers never have to
 * import drizzle's concrete transaction type.
 */
export type CareerTimelineTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// --- Dual-write helper --------------------------------------------------------

/**
 * Transaction-scoped core of the dual-write: insert one Career Event row and
 * update the matching `employees` column using the caller's existing `tx`.
 *
 * This is deliberately NOT wrapped in its own `db.transaction` — the legacy
 * Edit Employee path composes several of these with the full employee UPDATE
 * inside ONE transaction (see `updateEmployee`), so a failure anywhere rolls
 * back every write. `appendCareerEvent` below is the standalone entry point
 * that opens its own transaction for the Career Timeline dialog.
 *
 * Resolves the `from_*` snapshot from the employee's current row and the
 * `to_label` snapshot from the target masterdata row (or the supplied
 * `to_label` for `employment_status`, which has no FK). The label snapshot
 * survives masterdata renames (ADR-0007).
 */
export async function appendCareerEventTx(
  tx: CareerTimelineTransaction,
  input: AppendCareerEventInput
): Promise<AppendCareerEventResult> {
  const [current] = await tx
    .select({
      id: employees.id,
      department_id: employees.department_id,
      designation_id: employees.designation_id,
      employment_status: employees.employment_status
    })
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);
  if (!current) {
    throw new Error(`Employee ${input.employeeId} not found`);
  }

  const fromDepartmentId = current.department_id;
  const fromDesignationId = current.designation_id;
  const fromEmploymentStatus = current.employment_status;

  let from_label: string | null = null;
  let to_label: string;
  let from_designation_id: number | null = fromDesignationId;
  let to_designation_id: number | null = null;
  let from_department_id: number | null = fromDepartmentId;
  let to_department_id: number | null = null;

  if (input.category === 'position') {
    const [target] = await tx
      .select({ id: designations.id, name: designations.name })
      .from(designations)
      .where(eq(designations.id, input.toDesignationId))
      .limit(1);
    if (!target) {
      throw new Error(`Designation ${input.toDesignationId} not found`);
    }
    const fromRow = await tx
      .select({ name: designations.name })
      .from(designations)
      .where(eq(designations.id, fromDesignationId))
      .limit(1);
    from_label = fromRow[0]?.name ?? null;
    to_label = target.name;
    to_designation_id = target.id;
    from_department_id = null;
    to_department_id = null;
  } else if (input.category === 'division') {
    const [target] = await tx
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.id, input.toDepartmentId))
      .limit(1);
    if (!target) {
      throw new Error(`Department ${input.toDepartmentId} not found`);
    }
    const fromRow = await tx
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.id, fromDepartmentId))
      .limit(1);
    from_label = fromRow[0]?.name ?? null;
    to_label = target.name;
    from_designation_id = null;
    to_designation_id = null;
    to_department_id = target.id;
  } else {
    from_label = fromEmploymentStatus;
    to_label = input.toLabel;
    from_designation_id = null;
    to_designation_id = null;
    from_department_id = null;
    to_department_id = null;
  }

  const [inserted] = await tx
    .insert(employeeCareerEvents)
    .values({
      employee_id: input.employeeId,
      category: input.category,
      effective_date: input.effectiveDate,
      notes: input.notes,
      actor_user_id: input.actorUserId,
      from_designation_id,
      to_designation_id,
      from_department_id,
      to_department_id,
      from_label,
      to_label
    })
    .returning();
  if (!inserted) {
    throw new Error('insertCareerEvent returned no row');
  }

  if (input.category === 'position') {
    await tx
      .update(employees)
      .set({ designation_id: input.toDesignationId, updated_at: new Date() })
      .where(eq(employees.id, input.employeeId));
  } else if (input.category === 'division') {
    await tx
      .update(employees)
      .set({ department_id: input.toDepartmentId, updated_at: new Date() })
      .where(eq(employees.id, input.employeeId));
  } else {
    await tx
      .update(employees)
      .set({ employment_status: input.toLabel, updated_at: new Date() })
      .where(eq(employees.id, input.employeeId));
  }

  return inserted;
}

/**
 * Append one Career Event for one employee and update the matching column on
 * `employees` in the SAME transaction. Both writes succeed or both roll back —
 * the DB integration test forces the second write to throw and asserts that
 * neither row persists.
 *
 * The standalone dialog path uses this wrapper; the legacy multi-field edit
 * path calls `appendCareerEventTx` directly so every event shares one
 * transaction with the employee UPDATE.
 */
export async function appendCareerEvent(
  input: AppendCareerEventInput
): Promise<AppendCareerEventResult> {
  try {
    return await db.transaction((tx) => appendCareerEventTx(tx, input));
  } catch (e) {
    mapDbError(e, 'careerTimeline.appendCareerEvent');
  }
}

// --- Delete (≤5-minute correction window) -------------------------------------

export const CAREER_EVENT_DELETE_FORBIDDEN = 'CAREER_EVENT_DELETE_FORBIDDEN';

function forbidden(): never {
  throw new DomainError(
    'Career event can only be deleted within 5 minutes by the user who recorded it.',
    CAREER_EVENT_DELETE_FORBIDDEN
  );
}

/**
 * Hard-delete one Career Event within the 5-minute correction window.
 *
 * Removes ONLY the `employee_career_events` row — the matching `employees`
 * column is deliberately NOT reverted (the employee state is the source of
 * truth and only an append event changes it; see ADR-0007). Every guard is
 * evaluated in the DELETE's own WHERE clause and therefore inside the same
 * transaction/statement as the write, so a concurrent edit cannot slip between
 * the check and the write.
 *
 * The correction window is computed by the database (`now() - created_at <
 * interval '5 minutes'`) rather than in JS, so app/DB clock skew cannot widen
 * or narrow it. `created_at` is written by the database default (`now()`), so
 * the same session clock is used for both the write and the guard. The
 * actor-match and NULL-actor guards are also preserved: `NULL = $actor` is
 * never true, so system-seeded rows stay undeletable.
 *
 * Throws `CAREER_EVENT_DELETE_FORBIDDEN` (a `DomainError` code) when the
 * event does not exist, has no actor, was recorded by a different user, or
 * is older than 5 minutes.
 */
export async function deleteCareerEvent(
  eventId: number,
  actorUserId: string
): Promise<{ id: number }> {
  try {
    return await db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(employeeCareerEvents)
        .where(
          and(
            eq(employeeCareerEvents.id, eventId),
            eq(employeeCareerEvents.actor_user_id, actorUserId),
            sql`now() - ${employeeCareerEvents.created_at} < interval '5 minutes'`
          )
        )
        .returning({ id: employeeCareerEvents.id });

      if (!deleted) {
        forbidden();
      }
      return deleted;
    });
  } catch (e) {
    mapDbError(e, 'careerTimeline.deleteCareerEvent');
  }
}

/**
 * Read-only helper for the dual-write regression test: a mutation of
 * `employees.department_id` / `designation_id` / `employment_status`
 * MUST produce exactly one matching `employee_career_events` row.
 *
 * Filters to one employee + one category so the test can assert the
 * "exactly one" guarantee without interference from the seeded
 * `start_work` event or unrelated categories.
 */
export async function findCareerEventsFor(
  employeeId: string,
  filter: {
    category: 'position' | 'division' | 'employment_status';
    toLabel?: string;
    toDesignationId?: number;
    toDepartmentId?: number;
  }
): Promise<CareerEvent[]> {
  const conditions = [eq(employeeCareerEvents.employee_id, employeeId)];
  conditions.push(eq(employeeCareerEvents.category, filter.category));
  if (filter.toLabel !== undefined) {
    conditions.push(eq(employeeCareerEvents.to_label, filter.toLabel));
  }
  if (filter.toDesignationId !== undefined) {
    conditions.push(eq(employeeCareerEvents.to_designation_id, filter.toDesignationId));
  }
  if (filter.toDepartmentId !== undefined) {
    conditions.push(eq(employeeCareerEvents.to_department_id, filter.toDepartmentId));
  }
  return db
    .select()
    .from(employeeCareerEvents)
    .where(and(...conditions));
}

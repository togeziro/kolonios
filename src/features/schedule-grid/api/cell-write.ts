/**
 * Cell-level write primitives for the admin schedule grid.
 *
 * Single owner of the DELETE-then-INSERT shape (including the
 * orphan-prevention guard): every write path — the three single-cell server
 * fns in `write-service.ts`, both branches of `applyToWholeWeekFn`'s per-date
 * loop, both branches of `repeatWeekBulkFn`'s per-cell loop in
 * `bulk-service.ts`, and the three branches (clear/dayOff/shift) of the
 * `importMonthFn` loop in `import-service.ts` — composes through here
 * instead of re-deriving "delete both tables, then insert one row".
 *
 * Design notes:
 *  - Helpers take a `tx: DbTransaction` and never own `db.transaction`
 *    themselves, so the callers keep their own failure semantics:
 *    `withCellWrite` (abort-and-fold via `mapDbError`) for single cells vs
 *    capture-and-continue via `logger.error` for the two batch loops.
 *  - `createdBy` is threaded as a plain string so this module stays purely
 *    DB-level (no auth / rate-limit imports); the server-fn preamble stays
 *    with the caller.
 *  - Lives in `src/features/schedule-grid/api/` (not `src/lib/`) per
 *    ADR-0001, symmetric with `cell-resolver.ts`.
 */

import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { dateOverrides, dayOffs } from '@/lib/db/schema/attendance';

/**
 * Transaction handle type as passed by `db.transaction` — derived from the
 * method signature so callers never have to import drizzle's `PgTransaction`
 * explicitly. Defined once here; `write-service.ts` re-imports it.
 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Orphan-prevention guard, single source of truth: delete both the
 * `date_overrides` and `day_offs` rows for (userId, date) so a new insert
 * can never be masked by a stale sibling row. Every helper below calls this
 * first — no write path may DELETE/INSERT these tables directly.
 */
async function clearCellRows(tx: DbTransaction, userId: string, date: string): Promise<void> {
  await tx
    .delete(dateOverrides)
    .where(and(eq(dateOverrides.user_id, userId), eq(dateOverrides.date, date)));
  await tx.delete(dayOffs).where(and(eq(dayOffs.user_id, userId), eq(dayOffs.date, date)));
}

/** Write a shift override cell: clear both tables, then insert `date_overrides`. */
export async function writeCellShiftTx(
  tx: DbTransaction,
  args: { userId: string; date: string; shiftId: number; createdBy: string }
): Promise<void> {
  await clearCellRows(tx, args.userId, args.date);
  await tx.insert(dateOverrides).values({
    user_id: args.userId,
    date: args.date,
    shift_id: args.shiftId,
    created_by: args.createdBy
  });
}

/** Write a day-off cell: clear both tables, then insert `day_offs`. */
export async function writeCellDayOffTx(
  tx: DbTransaction,
  args: { userId: string; date: string; reason?: string | null; createdBy: string }
): Promise<void> {
  await clearCellRows(tx, args.userId, args.date);
  await tx.insert(dayOffs).values({
    user_id: args.userId,
    date: args.date,
    reason: args.reason ?? null,
    created_by: args.createdBy
  });
}

/** Clear a cell: run the orphan guard with no insert. */
export async function clearCellTx(
  tx: DbTransaction,
  args: { userId: string; date: string }
): Promise<void> {
  await clearCellRows(tx, args.userId, args.date);
}

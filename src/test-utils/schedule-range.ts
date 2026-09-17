// Shared DDL choreography for tests that need to seed PRE-EXISTING inverted
// `schedule_assignments` rows (Opsi B).
//
// The DB CHECK constraint `schedule_assignments_effective_range_check` ships
// with migration `0044` (bounded `effective_to`, simplified from `0043`'s
// nullable form), so a raw insert of an inverted row is rejected. To
// test read-side hardening against legacy/corrupt data, tests must temporarily
// drop the constraint, seed the inverted row, exercise the reader, then clean
// up and re-add the constraint. Postgres validates existing rows on
// `ADD CONSTRAINT`, so the cleanup also deletes the deliberately-seeded
// inverted rows first (valid rows stay).
//
// Single owner of that choreography — used by the attendance, schedule-grid,
// and payroll inverted-range integration tests.
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/** Drop the Opsi B range check (no-op when the migration has not run yet). */
async function dropScheduleRangeCheck(): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "schedule_assignments" DROP CONSTRAINT IF EXISTS "schedule_assignments_effective_range_check"`
  );
}

/**
 * Delete any leftover inverted rows and (re-)add the Opsi B range check.
 * Mirrors the constraint definition added by migration `0044`.
 */
async function restoreScheduleRangeCheck(): Promise<void> {
  await db.execute(sql`DELETE FROM "schedule_assignments" WHERE "effective_from" > "effective_to"`);
  await db.execute(
    sql`ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_effective_range_check" CHECK ("schedule_assignments"."effective_from" <= "schedule_assignments"."effective_to")`
  );
}

/** Idempotently guarantee the constraint exists (mirrors the migration). */
export async function ensureScheduleRangeCheck(): Promise<void> {
  await dropScheduleRangeCheck();
  await restoreScheduleRangeCheck();
}

/**
 * Run `fn` with the range check dropped (so inverted rows can be seeded),
 * restoring the constraint — and clearing the seeded inverted rows — in a
 * `finally` even when the assertions throw.
 */
export async function withInvertedRangeRows<T>(fn: () => Promise<T>): Promise<T> {
  await dropScheduleRangeCheck();
  try {
    return await fn();
  } finally {
    await restoreScheduleRangeCheck();
  }
}

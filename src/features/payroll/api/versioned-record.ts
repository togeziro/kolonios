import { and, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core';
import { DomainError } from '@/lib/errors';
import type { PayrollTransaction } from '@/lib/db/payroll';
import { asDateISO, type DateISO } from './date-iso';
import { closeEffectiveRecordAt, previousDate } from './shared';

type EffectiveVersionTable = AnyPgTable & {
  id: AnyPgColumn;
  effective_from: AnyPgColumn;
  effective_to: AnyPgColumn;
  updated_at: AnyPgColumn;
};

type VersionedUpsertOptions<TTable extends EffectiveVersionTable> = {
  tx: PayrollTransaction;
  table: TTable;
  values: TTable['$inferInsert'];
  effectiveFrom: DateISO;
  id?: number;
  identityWhere: SQL<unknown> | undefined;
  existingWhere: SQL<unknown> | undefined;
  errors: {
    notFound: [string, string];
    versionFailed: [string, string];
    createFailed: [string, string];
  };
  updateGuards?: (existing: TTable['$inferSelect']) => Promise<void> | void;
  createGuards?: () => Promise<void> | void;
};

export async function upsertVersionedRecord<TTable extends EffectiveVersionTable>(
  options: VersionedUpsertOptions<TTable>
): Promise<TTable['$inferSelect']> {
  const { tx, table, values, effectiveFrom, identityWhere, existingWhere, errors } = options;
  // Drizzle's generic table typing can't index columns on a type parameter,
  // so narrow to the columns the versioned-record protocol needs.
  const versioned = table as unknown as EffectiveVersionTable;
  const pgTable = table as unknown as AnyPgTable;

  if (options.id != null) {
    const rows = (await tx
      .select()
      .from(pgTable)
      .where(existingWhere)
      .limit(1)) as TTable['$inferSelect'][];
    const existing = rows[0];
    if (!existing) throw new DomainError(errors.notFound[0], errors.notFound[1]);
    // Postgres `date` columns always deserialize as 'YYYY-MM-DD' strings;
    // a NULL here would silently pass the immutability guard below.
    const rawFrom = existing.effective_from;
    if (typeof rawFrom !== 'string')
      throw new DomainError(
        'Payroll record is missing its effective_from date.',
        'INVALID_PAYROLL_DATA'
      );
    const existingFrom = asDateISO(rawFrom);
    if (existingFrom >= effectiveFrom)
      throw new DomainError(
        'Create a new payroll record version with a later effective date.',
        'HISTORICAL_RECORD_IMMUTABLE'
      );
    await options.updateGuards?.(existing);

    // Overlap check counts the record being replaced itself; a second
    // overlapping version is a data-integrity violation.
    const overlapping = (await tx
      .select()
      .from(pgTable)
      .where(
        and(
          identityWhere,
          lte(versioned.effective_from, effectiveFrom),
          or(sql`${versioned.effective_to} is null`, gte(versioned.effective_to, effectiveFrom))
        )
      )
      .limit(2)) as TTable['$inferSelect'][];
    if (overlapping.length > 1)
      throw new DomainError(
        'Overlapping payroll record versions exist.',
        'OVERLAPPING_EFFECTIVE_RECORDS'
      );

    await tx
      .update(table)
      .set({
        effective_to: closeEffectiveRecordAt(existingFrom, effectiveFrom),
        updated_at: new Date()
      } as TTable['$inferInsert'])
      .where(eq(versioned.id, existing.id));

    const row = (
      (await tx.insert(pgTable).values(values).returning()) as TTable['$inferSelect'][]
    )[0];
    if (!row) throw new DomainError(errors.versionFailed[0], errors.versionFailed[1]);
    return row;
  }

  await options.createGuards?.();

  const overlapping = (await tx
    .select()
    .from(pgTable)
    .where(
      and(
        identityWhere,
        lte(versioned.effective_from, effectiveFrom),
        or(sql`${versioned.effective_to} is null`, gte(versioned.effective_to, effectiveFrom))
      )
    )
    .limit(1)) as TTable['$inferSelect'][];
  if (overlapping.length > 0) {
    await tx
      .update(table)
      .set({
        effective_to: previousDate(effectiveFrom),
        updated_at: new Date()
      } as TTable['$inferInsert'])
      .where(eq(versioned.id, overlapping[0].id));
  }

  const row = (
    (await tx.insert(pgTable).values(values).returning()) as TTable['$inferSelect'][]
  )[0];
  if (!row) throw new DomainError(errors.createFailed[0], errors.createFailed[1]);
  return row;
}

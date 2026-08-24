import { DomainError } from '@/lib/errors';

declare const dateISOBrand: unique symbol;

/**
 * A calendar date string in `YYYY-MM-DD` form (e.g. `2026-07-16`).
 *
 * Postgres `date` columns and the API's zod schemas always produce strings in
 * this shape, so lexical comparison (`<`, `>=`) is a correct chronological
 * ordering. The brand exists purely at compile time — it is an intersection
 * with `string`, so values serialize and pass through Drizzle/zod/JSON
 * transparently.
 */
export type DateISO = string & { readonly [dateISOBrand]: true };

const DATE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a plain string into a branded {@link DateISO}, throwing a
 * `DomainError` when the value is not `YYYY-MM-DD`.
 */
export function parseDateISO(value: string): DateISO {
  if (!DATE_ISO_PATTERN.test(value))
    throw new DomainError('Date must be YYYY-MM-DD', 'INVALID_DATE');
  return value as DateISO;
}

/**
 * Zero-cost cast for values already guaranteed to be `YYYY-MM-DD`
 * (Postgres `date` columns always deserialize that way). Never use this on
 * unvalidated client input — use {@link parseDateISO} instead.
 */
export function asDateISO(value: string): DateISO {
  return value as DateISO;
}

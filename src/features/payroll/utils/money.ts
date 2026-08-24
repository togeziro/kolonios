import type { Money } from '../api/types';

/**
 * All monetary amounts in this feature are integer minor units (cents).
 * Float math on money is forbidden outside these helpers; conversions
 * between minor units, major units, and DB decimals happen ONLY here.
 * Inputs are assumed to be already-rounded integer cents; these helpers do
 * not validate integrality.
 */

const DB_DECIMAL_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function dbDecimalToMinor(text: string): Money {
  if (!DB_DECIMAL_PATTERN.test(text)) {
    throw new RangeError('Database money must be a non-negative decimal with at most 2 decimals.');
  }
  const [whole, fraction = ''] = text.split('.');
  const minor = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  const result = Number(minor);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Database money exceeds the safe integer range.');
  }
  return result;
}

/**
 * Converts a major-unit decimal (number or DB-style string) into integer cents.
 *
 * Contract:
 * - String inputs must match `/^\d+(?:\.\d{1,2})?$/` (non-negative, at most two
 *   decimal places) or a RangeError is thrown — no silent rounding.
 * - Number inputs are NOT validated against the same pattern: they are formatted
 *   via `toFixed(2)`, which silently rounds to 2 decimal places. Callers that
 *   need strictness should pass strings. Note `toFixed` rounding sits on binary
 *   float representation, so values exactly halfway between two 2-decimal
 *   candidates may round either way depending on float error (it is not a
 *   guaranteed half-away-from-zero or banker's rounding).
 */
export function toMinor(major: number | string): Money {
  return dbDecimalToMinor(typeof major === 'number' ? major.toFixed(2) : major);
}

/** Converts integer cents into major units. */
export function toMajor(cents: Money): number {
  return cents / 100;
}

/** Converts integer cents into a database numeric string with scale 2. */
export function toDbDecimal(cents: Money): string {
  return (cents / 100).toFixed(2);
}

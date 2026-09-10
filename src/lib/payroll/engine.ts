// Pure payroll-domain logic: effective-date resolution, PTKP status mapping,
// and JKK (BPJS Ketenagakerjaan Kecelakaan Kerja) rate constants. No DB, no IO,
// no clock — every function here is deterministic given its inputs and
// unit-testable without fixtures. Persistence lives in @/lib/db/payroll, which
// feeds these functions the rows they need.
import { DomainError } from '../errors';
import { asDateISO, type DateISO } from '../domain/date-iso';
import type { JkkRiskCategory } from '../domain/payroll';

// --- Row shapes (structural subsets of effective-dated payroll tables) ---

export type EffectiveRow = { id: number; effective_from: DateISO; effective_to: DateISO | null };
export type RawEffectiveRow = {
  id: number;
  effective_from: string;
  effective_to: string | null;
};

export function toEffectiveRows<T extends RawEffectiveRow>(rows: T[]): Array<T & EffectiveRow> {
  return rows.map((row) => ({
    ...row,
    effective_from: asDateISO(row.effective_from),
    effective_to: row.effective_to ? asDateISO(row.effective_to) : null
  }));
}

// --- Date / range assertions (pure; no clock) ---

export function assertEffectiveDate(value: string) {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = match ? new Date(`${value}T00:00:00Z`) : new Date('invalid');
  if (!match || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DomainError('A valid ISO calendar date is required.', 'INVALID_DATE');
  }
}

export function assertDateRange(periodStart: string, periodEnd: string) {
  assertEffectiveDate(periodStart);
  assertEffectiveDate(periodEnd);
  if (periodStart > periodEnd) {
    throw new DomainError(
      'Payroll period start must be on or before its end.',
      'INVALID_DATE_RANGE'
    );
  }
}

export const validatePayrollDateRange = assertDateRange;

// --- Effective-dated record resolution ---

/** Resolve an ordered effective-dated result while making overlap ambiguity explicit. */
export function resolveEffectiveRecord<T extends RawEffectiveRow>(
  employeeId: string,
  asOfDate: string,
  rows: T[]
): (T & EffectiveRow) | null {
  assertEffectiveDate(asOfDate);
  const asOf = asDateISO(asOfDate);
  const active = toEffectiveRows(rows).filter(
    (row) => row.effective_from <= asOf && (!row.effective_to || row.effective_to >= asOf)
  );
  if (active.length > 1) {
    throw new DomainError(
      `Overlapping effective payroll records for employee ${employeeId}.`,
      'OVERLAPPING_EFFECTIVE_RECORDS'
    );
  }
  return active[0] ?? null;
}

export function resolveEffectiveRecords<T extends RawEffectiveRow>(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  rows: T[]
) {
  assertDateRange(periodStart, periodEnd);
  const start = asDateISO(periodStart);
  const end = asDateISO(periodEnd);
  const points = [
    start,
    ...toEffectiveRows(rows)
      .map((row) => row.effective_from)
      .filter((date) => date > start && date <= end)
  ].toSorted();
  const selected = new Map<number, T & EffectiveRow>();
  for (const point of points) {
    const row = resolveEffectiveRecord(employeeId, point, rows);
    if (row) selected.set(row.id, row);
  }
  return [...selected.values()].toSorted(
    (left, right) => left.effective_from.localeCompare(right.effective_from) || left.id - right.id
  );
}

export function requireEffectiveRecord<T extends RawEffectiveRow>(
  employeeId: string,
  asOfDate: string,
  rows: T[]
) {
  const row = resolveEffectiveRecord(employeeId, asOfDate, rows);
  if (!row)
    throw new DomainError(
      'Required payroll data is missing for this period.',
      'MISSING_PAYROLL_DATA'
    );
  return row as T & EffectiveRow;
}

// --- PTKP (Penghasilan Tidak Kena Pajak) status table ---

/**
 * Annual PTKP amounts in IDR by taxpayer status. Source: Indonesian tax law;
 * values are the canonical Indonesian brackets used to compute monthly
 * non-taxable income for PPh21 Article 21. Monthly values are derived by
 * `mapPtkpStatusToAmount` (annual ÷ 12, rounded to the nearest whole IDR).
 */
export const PTKP_STATUS_ANNUAL: Record<string, number> = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'TK/2': 63_000_000,
  'TK/3': 67_500_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000
};

/**
 * Map a PTKP status code (e.g. `TK/0`, `K/3`) to its monthly non-taxable
 * income in IDR. Throws `INVALID_PTKP_STATUS` for unknown statuses.
 */
export function mapPtkpStatusToAmount(status: string): number {
  const annual = PTKP_STATUS_ANNUAL[status];
  if (!annual) throw new DomainError(`Invalid PTKP status: ${status}`, 'INVALID_PTKP_STATUS');
  return Math.round(annual / 12);
}

// --- BPJS rate constants ---

/**
 * BPJS Ketenagakerjaan JKK company-side contribution rates (percent of
 * registered wage), by risk category. Categories follow Indonesian
 * Manpower Ministry classification (Permenaker No. 01/MEN/1989 onwards).
 */
export const JKK_RATES: Record<JkkRiskCategory, number> = {
  very_low: 0.24,
  low: 0.54,
  medium: 0.89,
  high: 1.27,
  very_high: 1.74
};

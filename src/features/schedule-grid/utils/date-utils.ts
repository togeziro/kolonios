/**
 * Pure date utilities for the schedule-grid feature.
 * No side effects, no DB, no React — easy to unit test.
 */

import type { WeekStart } from './constants';

const DAY_MS = 86_400_000;

/**
 * Parse a YYYY-MM-DD string into a UTC Date at midnight. Using UTC avoids
 * the local-timezone off-by-one the engine's `dayOfWeekFromDate` already
 * guards against (it uses `new Date(y, m-1, d)` for that reason).
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  return formatDate(new Date(d.getTime() + days * DAY_MS));
}

/**
 * Get day of week (0=Sun..6=Sat) for a YYYY-MM-DD string.
 * Mirrors `dayOfWeekFromDate` in `src/lib/attendance/schedule.ts`.
 */
export function dayOfWeek(dateStr: string): number {
  return parseDate(dateStr).getUTCDay();
}

/**
 * Compute the week-start (inclusive) for a given date. `weekStart` is the
 * anchor day: 'monday' returns the Monday of the same ISO week, 'sunday'
 * returns the Sunday of the same calendar week.
 */
export function startOfWeek(dateStr: string, weekStart: WeekStart): string {
  const dow = dayOfWeek(dateStr);
  const offset = weekStart === 'monday' ? (dow === 0 ? 6 : dow - 1) : dow;
  return addDays(dateStr, -offset);
}

/**
 * Return the seven consecutive YYYY-MM-DD strings starting at `weekStart`
 * (inclusive). The order is left-to-right as the columns should be rendered.
 */
export function weekDays(weekStart: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    out.push(addDays(weekStart, i));
  }
  return out;
}

export function monthOfDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/**
 * "Aug 25 – Aug 31, 2026" style range label. Always renders in en-US
 * locale (no translation) because month abbreviations are widely
 * understood in the Indonesian admin UI without forcing i18n bundles.
 */
export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = parseDate(weekStart);
  const end = parseDate(weekEnd);
  const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const dayFmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });
  const yearFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });
  const startMonth = monthFmt.format(start);
  const endMonth = monthFmt.format(end);
  const startDay = dayFmt.format(start);
  const endDay = dayFmt.format(end);
  const year = yearFmt.format(end);
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

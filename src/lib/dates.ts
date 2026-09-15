const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Jakarta';

/**
 * Strict `YYYY-MM-DD` shape check, shared by every Career Event
 * validation surface (wire schemas + the dialog's client-side guard).
 */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function businessDateInTimeZone(
  now: Date | number | string,
  timeZone: string = DEFAULT_BUSINESS_TIME_ZONE
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(now));
}

/**
 * Clock time (`HH:MM:SS`, 24-hour) in the business timezone. Server runtimes
 * report UTC, so `toLocaleTimeString` without an explicit `timeZone` stores
 * UTC clock times while the business date next to it is WIB — check-in/out
 * times then read 7 hours early and lateness math compares UTC against WIB
 * schedules. Always use this where a WIB wall-clock time is stored.
 */
export function businessTimeInTimeZone(
  now: Date | number | string,
  timeZone: string = DEFAULT_BUSINESS_TIME_ZONE
): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  }).format(new Date(now));
}

/**
 * Number of days in a `YYYY-MM` month (28/29/30/31), shared by the
 * schedule grid export (`schedule-grid/utils/date-utils.ts` re-exports
 * this) and the technician month grid. Day 0 of the following month =
 * last day of the target month (UTC-safe, no local-time DST edge).
 */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

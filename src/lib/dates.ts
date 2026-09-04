const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Jakarta';

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
 * Number of days in a `YYYY-MM` month (28/29/30/31), shared by the
 * schedule grid export (`schedule-grid/utils/date-utils.ts` re-exports
 * this) and the technician month grid. Day 0 of the following month =
 * last day of the target month (UTC-safe, no local-time DST edge).
 */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

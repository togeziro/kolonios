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

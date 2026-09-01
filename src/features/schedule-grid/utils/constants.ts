/**
 * Schedule grid (admin weekly view) feature-level constants.
 *
 * - SEARCH_DEBOUNCE_MS — debounce for the employee-name search input.
 * - WEEKEND_DAYS — days of the week treated as weekend for Indonesian
 *   business calendar (Sat=6, Sun=0). Ticket 02's "apply to week" toggle
 *   gates `includeWeekend` against this set.
 */

export const SEARCH_DEBOUNCE_MS = 300;

export const WEEKEND_DAYS = [6, 0] as const;

export type WeekStart = 'monday' | 'sunday';

export const WEEK_START_OPTIONS: ReadonlyArray<WeekStart> = ['monday', 'sunday'];

export const DEFAULT_WEEK_START: WeekStart = 'monday';

export const WEEK_START_STORAGE_KEY = 'kolonios-schedule-grid-week-start';

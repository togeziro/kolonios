/**
 * SSR-safe week-start preference, persisted per-user in localStorage.
 *
 * Mirrors the `useSyncExternalStore` pattern in
 * `src/lib/preferences/shell-dark.ts`:
 *  - The third `getServerSnapshot` arg keeps the server render stable
 *    at `DEFAULT_WEEK_START` (avoids hydration mismatch).
 *  - The `read()` helper returns a localStorage override when present,
 *    falling back to the default. The try/catch shields against SSR /
 *    private-mode / disabled-storage environments.
 *  - The `write()` helper fans out to listeners, so every component using
 *    this hook re-renders the moment the user toggles — including other
 *    tabs, since `subscribe` is process-scoped (cross-tab sync is via the
 *    'storage' event that we wire in the subscribe body).
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_WEEK_START,
  WEEK_START_OPTIONS,
  WEEK_START_STORAGE_KEY,
  type WeekStart
} from '../utils/constants';

function isWeekStart(value: unknown): value is WeekStart {
  return typeof value === 'string' && (WEEK_START_OPTIONS as ReadonlyArray<string>).includes(value);
}

let current: WeekStart | null = null;
const listeners = new Set<() => void>();

function read(): WeekStart {
  if (current != null) return current;
  if (typeof window === 'undefined') return DEFAULT_WEEK_START;
  try {
    const raw = window.localStorage.getItem(WEEK_START_STORAGE_KEY);
    return isWeekStart(raw) ? raw : DEFAULT_WEEK_START;
  } catch {
    return DEFAULT_WEEK_START;
  }
}

function write(next: WeekStart) {
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WEEK_START_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  if (typeof window !== 'undefined') {
    // Cross-tab reactivity: a sibling tab changing the preference fires a
    // `storage` event whose key matches; re-read and notify our subscribers.
    const handler = (event: StorageEvent) => {
      if (event.key === WEEK_START_STORAGE_KEY || event.key === null) {
        const next = read();
        if (current !== next) {
          current = next;
          listeners.forEach((l) => l());
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => {
      listeners.delete(notify);
      window.removeEventListener('storage', handler);
    };
  }
  return () => {
    listeners.delete(notify);
  };
}

function getServerSnapshot(): WeekStart {
  return DEFAULT_WEEK_START;
}

export function useWeekStartPreference(): [WeekStart, (next: WeekStart) => void] {
  const value = useSyncExternalStore(subscribe, read, getServerSnapshot);
  const set = useCallback((next: WeekStart) => write(next), []);
  return [value, set];
}

// localStorage-backed dark preference for the fieldops mobile shell, shared
// with in-app theme rows so they can drive the same source of truth.
import { useSyncExternalStore } from 'react';
const SHELL_DARK_KEY = 'kolonios-shell-dark';

const listeners = new Set<() => void>();
let override: boolean | null = null;

function read(): boolean {
  if (override !== null) return override;
  try {
    return localStorage.getItem(SHELL_DARK_KEY) !== 'false';
  } catch {
    return true;
  }
}

function write(next: boolean) {
  override = next;
  try {
    localStorage.setItem(SHELL_DARK_KEY, String(next));
  } catch {
    // ignore storage failures
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// Server snapshot stays the default `true`, matching the pre-hydration render.
export function useShellDark() {
  return useSyncExternalStore(subscribe, read, () => true);
}

export function setShellDark(next: boolean) {
  write(next);
}

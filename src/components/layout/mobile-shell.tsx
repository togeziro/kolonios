import { useEffect, useSyncExternalStore } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { MobileHeader } from './mobile-header';
import { BottomNav } from './bottom-nav';

const SHELL_DARK_KEY = 'kolonios-shell-dark';

// localStorage-backed store so the shell can derive `dark` during render
// (server snapshot is always the default `true`, matching the pre-hydration
// render; the client snapshot re-reads after mount, mirroring an effect).
const shellDarkListeners = new Set<() => void>();
let shellDarkOverride: boolean | null = null;

function readShellDark(): boolean {
  if (shellDarkOverride !== null) return shellDarkOverride;
  try {
    return localStorage.getItem(SHELL_DARK_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeShellDark(next: boolean) {
  shellDarkOverride = next;
  try {
    localStorage.setItem(SHELL_DARK_KEY, String(next));
  } catch {
    // ignore storage failures
  }
  shellDarkListeners.forEach((notify) => notify());
}

function subscribeShellDark(notify: () => void) {
  shellDarkListeners.add(notify);
  return () => shellDarkListeners.delete(notify);
}

export function MobileShell() {
  const { setTheme } = useTheme();
  const dark = useSyncExternalStore(subscribeShellDark, readShellDark, () => true);

  // Keep next-themes in sync with the stored preference (runs on mount and
  // whenever the preference changes; setTheme itself is idempotent).
  useEffect(() => {
    setTheme(dark ? 'dark' : 'light');
  }, [setTheme, dark]);

  const toggleDark = () => {
    writeShellDark(!dark);
  };

  return (
    <div
      className={`${dark ? 'dark' : ''} mx-auto flex h-[100dvh] max-w-[430px] flex-col overflow-hidden border-x bg-background shadow-2xl`}
    >
      <MobileHeader dark={dark} onToggleDark={toggleDark} />
      <main className='min-h-0 flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]'>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

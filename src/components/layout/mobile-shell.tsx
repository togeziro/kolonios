import { useEffect, useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { MobileHeader } from './mobile-header';
import { BottomNav } from './bottom-nav';

const SHELL_DARK_KEY = 'kolonios-shell-dark';

function readShellDark(): boolean {
  try {
    return localStorage.getItem(SHELL_DARK_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function MobileShell() {
  const { setTheme } = useTheme();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = readShellDark();
    setDark(stored);
    setTheme(stored ? 'dark' : 'light');
  }, [setTheme]);

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      setTheme(next ? 'dark' : 'light');
      try {
        localStorage.setItem(SHELL_DARK_KEY, String(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  return (
    <div
      className={`${dark ? 'dark' : ''} mx-auto min-h-screen max-w-[430px] overflow-x-hidden border-x bg-background shadow-2xl`}
    >
      <MobileHeader dark={dark} onToggleDark={toggleDark} />
      <main className='pb-[calc(5rem+env(safe-area-inset-bottom))]'>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

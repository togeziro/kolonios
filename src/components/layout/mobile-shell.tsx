import { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { MobileHeader } from './mobile-header';
import { BottomNav } from './bottom-nav';
import { setShellDark, useShellDark } from '@/lib/preferences/shell-dark';

export function MobileShell() {
  const { setTheme } = useTheme();
  const dark = useShellDark();

  // Keep next-themes in sync with the stored preference (runs on mount and
  // whenever the preference changes; setTheme itself is idempotent).
  useEffect(() => {
    setTheme(dark ? 'dark' : 'light');
  }, [setTheme, dark]);

  const toggleDark = () => {
    setShellDark(!dark);
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

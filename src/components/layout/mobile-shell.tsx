import { Outlet } from '@tanstack/react-router';
import { MobileHeader } from './mobile-header';
import { BottomNav } from './bottom-nav';

export function MobileShell() {
  return (
    <div className='mx-auto min-h-screen max-w-lg bg-background'>
      <MobileHeader />
      <main className='pb-[calc(5rem+env(safe-area-inset-bottom))]'>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

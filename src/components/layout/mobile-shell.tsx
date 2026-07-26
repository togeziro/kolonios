import { Outlet } from '@tanstack/react-router';
import { MobileHeader } from './mobile-header';
import { BottomNav } from './bottom-nav';

export function MobileShell() {
  return (
    <div className='mx-auto min-h-screen max-w-lg bg-background'>
      <MobileHeader />
      <main className='pb-20'>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

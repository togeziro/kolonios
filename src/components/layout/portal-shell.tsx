import { Outlet, useRouter } from '@tanstack/react-router';
import { authClient } from '@/lib/auth/auth-client';
import { Icons } from '@/components/icons';
import { useTranslation } from 'react-i18next';

export function PortalShell() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className='mx-auto flex min-h-screen max-w-lg flex-col bg-background'>
      <header className='bg-primary text-primary-foreground flex h-14 items-center justify-between px-4'>
        <div className='flex items-center gap-2'>
          <Icons.logo className='size-5' />
          <span className='text-sm font-semibold'>{t('portal.title')}</span>
        </div>
        <button
          type='button'
          aria-label={t('portal.signOut')}
          className='flex items-center gap-1 text-sm'
          onClick={async () => {
            await authClient.signOut();
            router.navigate({ to: '/auth/v2/sign-in' });
          }}
        >
          <Icons.logout className='size-4' />
          {t('portal.signOut')}
        </button>
      </header>
      <main className='flex-1 p-4'>
        <Outlet />
      </main>
    </div>
  );
}

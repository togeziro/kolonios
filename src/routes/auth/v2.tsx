import { IconCommand } from '@tabler/icons-react';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/auth/v2')({
  component: V2AuthLayout
});

function V2AuthLayout() {
  const { t } = useTranslation();
  return (
    <main>
      <div className='grid h-dvh justify-center p-2 lg:grid-cols-2'>
        <div className='relative order-2 hidden h-full rounded-3xl bg-primary lg:flex'>
          <div className='absolute top-10 space-y-1 px-10 text-primary-foreground'>
            <IconCommand className='size-10' />
            <h1 className='font-medium text-2xl'>{t('auth.brand')}</h1>
            <p className='text-sm'>{t('auth.tagline')}</p>
          </div>

          <div className='absolute bottom-10 flex w-full justify-between px-10'>
            <div className='flex-1 space-y-1 text-primary-foreground'>
              <h2 className='font-medium'>{t('auth.readyToLaunch')}</h2>
              <p className='text-sm'>{t('auth.readyDescription')}</p>
            </div>
            <Separator orientation='vertical' className='mx-3 h-auto!' />
            <div className='flex-1 space-y-1 text-primary-foreground'>
              <h2 className='font-medium'>{t('auth.needHelp')}</h2>
              <p className='text-sm'>{t('auth.helpDescription')}</p>
            </div>
          </div>
        </div>
        <div className='relative order-1 flex h-full'>
          <Outlet />
        </div>
      </div>
    </main>
  );
}

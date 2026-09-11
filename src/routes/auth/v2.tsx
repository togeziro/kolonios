import { Outlet, createFileRoute } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';
import { BrandLogo, BrandName } from '@/features/branding/components/brand-logo';

export const Route = createFileRoute('/auth/v2')({
  component: V2AuthLayout
});

/**
 * Company identity header for the auth promo panel. Shows the uploaded
 * logo + company name, falling back to the product brand when no branding
 * is set. The light tile keeps any uploaded artwork contrast-safe on the
 * primary panel; `text-primary` keeps the fallback icon visible on it
 * (uploaded images don't inherit text color).
 */
export function V2BrandHeader() {
  const { t } = useTranslation();
  return (
    <div className='absolute top-10 space-y-1 px-10 text-primary-foreground'>
      <div className='bg-primary-foreground text-primary flex size-14 items-center justify-center rounded-xl'>
        <BrandLogo className='size-10' />
      </div>
      <p className='font-medium text-2xl'>
        <BrandName fallback={t('auth.brand')} />
      </p>
      <p className='text-sm'>{t('auth.tagline')}</p>
    </div>
  );
}

function V2AuthLayout() {
  const { t } = useTranslation();
  return (
    <main>
      <div className='grid h-dvh justify-center p-2 lg:grid-cols-2'>
        <div className='relative order-2 hidden h-full rounded-3xl bg-primary lg:flex'>
          <V2BrandHeader />

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

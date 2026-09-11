import { Outlet, createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BrandLogo, BrandName } from '@/features/branding/components/brand-logo';
import { usePublicBranding } from '@/features/branding/api/public-queries';

export const Route = createFileRoute('/auth/v2')({
  component: V2AuthLayout
});

/**
 * Company identity header for the auth promo panel. Shows the uploaded
 * logo + company name, falling back to the product brand when no branding
 * is set. The light tile keeps any uploaded artwork contrast-safe on the
 * primary panel; `text-primary` keeps the fallback icon visible on it
 * (uploaded images don't inherit text color). The public tagline appears
 * below the name only when configured — empty values hide the row
 * entirely rather than falling back to i18n defaults.
 */
export function V2BrandHeader() {
  const { t } = useTranslation();
  const { data: branding } = usePublicBranding();
  const tagline = branding?.tagline?.trim();
  return (
    <div className='absolute top-10 space-y-1 px-10 text-primary-foreground'>
      <div className='bg-primary-foreground text-primary flex size-14 items-center justify-center rounded-xl'>
        <BrandLogo className='size-10' />
      </div>
      <p className='font-medium text-2xl'>
        <BrandName fallback={t('auth.brand')} />
      </p>
      {tagline ? <p className='text-sm'>{tagline}</p> : null}
    </div>
  );
}

function V2AuthLayout() {
  return (
    <main>
      <div className='grid h-dvh justify-center p-2 lg:grid-cols-2'>
        <div className='relative order-2 hidden h-full rounded-3xl bg-primary lg:flex'>
          <V2BrandHeader />
        </div>
        <div className='relative order-1 flex h-full'>
          <Outlet />
        </div>
      </div>
    </main>
  );
}

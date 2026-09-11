import { useTranslation } from 'react-i18next';
import { BrandLogo, BrandName } from '@/features/branding/components/brand-logo';
import { usePublicBranding } from '@/features/branding/api/public-queries';

/**
 * Company identity header for the sign-up brand panel. Shows the uploaded
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

export function BrandPanelPattern() {
  return (
    <div className='pointer-events-none absolute inset-0 overflow-hidden rounded-3xl'>
      <svg
        className='absolute inset-0 h-full w-full opacity-[0.08]'
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden
      >
        <defs>
          <pattern id='sign-up-grid' width='32' height='32' patternUnits='userSpaceOnUse'>
            <path d='M 32 0 L 0 0 0 32' fill='none' stroke='currentColor' strokeWidth='1' />
          </pattern>
        </defs>
        <rect
          width='100%'
          height='100%'
          fill='url(#sign-up-grid)'
          className='text-primary-foreground'
        />
      </svg>
      <div className='absolute -right-24 -bottom-24 size-96 rounded-full bg-primary-foreground/10 blur-3xl' />
    </div>
  );
}

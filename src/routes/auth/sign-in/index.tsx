import { Link, createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BrandLogo, BrandName } from '@/features/branding/components/brand-logo';
import { usePublicBranding } from '@/features/branding/api/public-queries';
import UserAuthForm from '@/features/auth/components/user-auth-form';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/auth/sign-in/')({
  head: () => ({
    meta: [{ title: 'Sign In' }]
  }),
  component: SignInPage
});

/**
 * Editorial hero layout (picked from the 3-way sign-in prototype
 * comparison, Sep 2026): full-bleed branded backdrop with the form in
 * a floating card. Sign-up keeps the split-screen layout, so each page
 * owns its own full-bleed chrome — there is no shared /auth parent.
 */
function SignInPage() {
  const { t } = useTranslation();
  const { data: branding } = usePublicBranding();
  return (
    <main className='relative min-h-dvh overflow-hidden bg-foreground text-background'>
      <SignInBackdrop />
      <TopRightLink />
      <SignInFooter />

      <div className='relative mx-auto flex min-h-dvh max-w-7xl items-center px-6 py-16'>
        <div className='grid w-full items-center gap-10 lg:grid-cols-2'>
          <div className='hidden text-primary-foreground lg:block'>
            <div className='mb-8'>
              <BrandMark tone='onPrimary' />
            </div>
            <h2 className='text-balance font-semibold text-5xl leading-[1.05] tracking-tight'>
              <BrandName fallback={t('auth.brand')} />
            </h2>
            <p className='mt-4 max-w-md text-pretty text-lg leading-relaxed opacity-80'>
              {branding?.tagline?.trim() || t('auth.heroSubtitle')}
            </p>
            <ul className='mt-8 space-y-2 text-sm opacity-80'>
              {[t('auth.heroPoint1'), t('auth.heroPoint2'), t('auth.heroPoint3')].map((point) => (
                <li key={point} className='flex items-center gap-2'>
                  <span className='size-1.5 rounded-full bg-primary-foreground/70' />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className='mx-auto w-full max-w-md rounded-2xl bg-background/95 p-8 text-foreground shadow-2xl ring-1 ring-border backdrop-blur-md sm:p-10 dark:bg-card/95'>
            <div className='mb-6 flex justify-center lg:hidden'>
              <BrandMark tone='onLight' />
            </div>
            <div className='mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[380px]'>
              <div className='space-y-2 text-center'>
                <h1 className='font-semibold text-3xl tracking-tight'>{t('auth.loginTitle')}</h1>
                <p className='text-sm text-muted-foreground'>{t('auth.loginSubtitle')}</p>
              </div>
              <div className='space-y-4'>
                <UserAuthForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function BrandMark({ tone }: { tone: 'onLight' | 'onPrimary' }) {
  const { t } = useTranslation();
  const { data: branding } = usePublicBranding();
  const tagline = branding?.tagline?.trim();
  const onPrimary = tone === 'onPrimary';
  return (
    <div className={cn('flex items-center gap-3', onPrimary && 'text-primary-foreground')}>
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-xl',
          onPrimary
            ? 'bg-primary-foreground text-primary'
            : 'border border-border bg-background text-foreground'
        )}
      >
        <BrandLogo className='size-8' />
      </div>
      <div className='space-y-0.5'>
        <p className='font-semibold text-xl leading-tight'>
          <BrandName fallback={t('auth.brand')} />
        </p>
        {tagline ? (
          <p className={cn('text-sm', onPrimary ? 'opacity-90' : 'text-muted-foreground')}>
            {tagline}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TopRightLink() {
  const { t } = useTranslation();
  return (
    <div className='absolute top-5 left-0 right-0 z-10 px-6 sm:px-10'>
      <div className='flex justify-end text-sm'>
        <span className='text-primary-foreground/80'>{t('auth.dontHaveAccount')}</span>{' '}
        <Link
          className='ml-1 text-primary-foreground underline-offset-4 hover:underline'
          to='/auth/sign-up'
        >
          {t('auth.register')}
        </Link>
      </div>
    </div>
  );
}

function SignInFooter() {
  const { t } = useTranslation();
  const { data: branding } = usePublicBranding();
  const year = branding?.copyrightYear ?? new Date().getFullYear();
  return (
    <div className='absolute bottom-5 left-0 right-0 z-10 flex flex-col gap-2 px-6 sm:px-10'>
      <div className='flex items-end justify-between gap-2'>
        <div className='text-sm text-primary-foreground/80'>
          {t('auth.copyright', {
            year,
            name: branding?.name ?? t('auth.brand')
          })}
        </div>
        <div className='flex items-center gap-1'>
          <LanguageSwitcher />
          <ThemeModeToggle />
        </div>
      </div>
    </div>
  );
}

function SignInBackdrop() {
  return (
    <>
      <div className='pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/90 via-primary to-primary/60' />
      <svg
        className='pointer-events-none absolute inset-0 h-full w-full opacity-20 mix-blend-screen'
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden
      >
        <defs>
          <pattern id='signin-grid' width='48' height='48' patternUnits='userSpaceOnUse'>
            <path d='M 48 0 L 0 0 0 48' fill='none' stroke='currentColor' strokeWidth='0.5' />
          </pattern>
          <radialGradient id='signin-glow' cx='20%' cy='30%' r='60%'>
            <stop offset='0%' stopColor='white' stopOpacity='0.35' />
            <stop offset='100%' stopColor='white' stopOpacity='0' />
          </radialGradient>
        </defs>
        <rect width='100%' height='100%' fill='url(#signin-grid)' className='text-white' />
        <rect width='100%' height='100%' fill='url(#signin-glow)' />
      </svg>
      <div className='pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-primary-foreground/10 blur-3xl' />
      <div className='pointer-events-none absolute -bottom-32 -left-32 size-[420px] rounded-full bg-primary-foreground/5 blur-3xl' />
    </>
  );
}

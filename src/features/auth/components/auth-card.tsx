import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/features/branding/components/brand-logo';
import { usePublicBranding } from '@/features/branding/api/public-queries';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';

interface AuthCardProps {
  title: string;
  subtitle: string;
  linkLabel: string;
  linkTo: string;
  linkText: string;
  children: React.ReactNode;
}

export default function AuthCard({
  title,
  subtitle,
  linkLabel,
  linkTo,
  linkText,
  children
}: AuthCardProps) {
  const { t } = useTranslation();
  const { data: branding } = usePublicBranding();
  const year = branding?.copyrightYear ?? new Date().getFullYear();
  return (
    <>
      <div className='mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]'>
        <div className='space-y-2 text-center'>
          {branding?.name && (
            <div className='flex flex-col items-center justify-center gap-2'>
              {branding?.logoLight || branding?.logoDark ? (
                <BrandLogo className='h-12 w-auto' />
              ) : null}
              <span className='text-xl font-semibold'>{branding.name}</span>
            </div>
          )}
          <h1 className='font-medium text-3xl'>{title}</h1>
          <p className='text-muted-foreground text-sm'>{subtitle}</p>
        </div>
        <div className='space-y-4'>{children}</div>
      </div>

      <div className='absolute top-5 flex w-full justify-end px-10'>
        <div className='text-muted-foreground text-sm'>
          {linkLabel}{' '}
          <Link className='text-foreground' to={linkTo}>
            {linkText}
          </Link>
        </div>
      </div>

      <div className='absolute bottom-5 flex w-full flex-col gap-2 px-10'>
        <div className='flex w-full justify-between gap-2'>
          <div className='text-sm'>
            {t('auth.copyright', {
              year,
              name: branding?.name ?? t('auth.brand')
            })}
          </div>
        </div>
        <div className='flex w-full items-center justify-end gap-1'>
          <LanguageSwitcher />
          <ThemeModeToggle />
        </div>
      </div>
    </>
  );
}

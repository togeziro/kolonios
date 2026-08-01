import { IconWorld } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  return (
    <>
      <div className='mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]'>
        <div className='space-y-2 text-center'>
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

      <div className='absolute bottom-5 flex w-full justify-between px-10'>
        <div className='text-sm'>{t('auth.copyright', { year: new Date().getFullYear() })}</div>
        <div className='flex items-center gap-1 text-sm'>
          <IconWorld className='size-4 text-muted-foreground' />
          {i18n.language.toUpperCase()}
        </div>
      </div>
    </>
  );
}

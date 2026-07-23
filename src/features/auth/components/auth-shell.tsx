import { IconCommand } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

interface AuthShellProps {
  title: string;
  subtitle: string;
  form: React.ReactNode;
  googleButtonLabel: string;
  footerPrefix: string;
  footerLinkTo: string;
  footerLinkLabel: string;
  children: React.ReactNode;
}

export default function AuthShell({
  title,
  subtitle,
  form,
  googleButtonLabel,
  footerPrefix,
  footerLinkTo,
  footerLinkLabel,
  children
}: AuthShellProps) {
  return (
    <div className='flex h-dvh'>
      <div className='hidden bg-primary lg:block lg:w-1/3'>
        <div className='flex h-full flex-col items-center justify-center p-12 text-center'>
          <div className='space-y-6'>
            <IconCommand className='mx-auto size-12 text-primary-foreground' />
            <div className='space-y-2'>
              <h1 className='font-light text-5xl text-primary-foreground'>{title}</h1>
              <p className='text-primary-foreground/80 text-xl'>{subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className='flex w-full items-center justify-center bg-background p-8 lg:w-2/3'>
        <div className='w-full max-w-md space-y-10 py-24 lg:py-32'>
          {children}
          <div className='space-y-4'>
            {form}
            <Button variant='outline' className='w-full' type='button' disabled>
              <IconCommand className='mr-2 size-4' />
              {googleButtonLabel}
            </Button>
            <p className='text-center text-muted-foreground text-xs'>
              {footerPrefix}{' '}
              <Link to={footerLinkTo} className='text-primary'>
                {footerLinkLabel}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { IconCommand } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import AuthCard from '@/features/auth/components/auth-card';
import UserAuthForm from '@/features/auth/components/user-auth-form';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/auth/v2/sign-in/')({
  head: () => ({
    meta: [{ title: 'Sign In - V2' }]
  }),
  component: SignInV2Page
});

function SignInV2Page() {
  const { t } = useTranslation();
  return (
    <AuthCard
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      linkLabel={t('auth.dontHaveAccount')}
      linkTo='/auth/v2/sign-up'
      linkText={t('auth.register')}
    >
      <Button variant='secondary' className='w-full' type='button' disabled>
        <IconCommand className='mr-2 size-4' />
        {t('auth.continueWithGoogle')}
      </Button>
      <div className='relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t'>
        <span className='relative z-10 bg-background px-2 text-muted-foreground'>
          {t('auth.orContinueWith')}
        </span>
      </div>
      <UserAuthForm />
    </AuthCard>
  );
}

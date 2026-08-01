import { IconCommand } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import AuthCard from '@/features/auth/components/auth-card';
import RegisterForm from '@/features/auth/components/register-form';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/auth/v2/sign-up/')({
  head: () => ({
    meta: [{ title: 'Sign Up - V2' }]
  }),
  component: SignUpV2Page
});

function SignUpV2Page() {
  const { t } = useTranslation();
  return (
    <AuthCard
      title={t('auth.createAccountTitle')}
      subtitle={t('auth.createAccountSubtitle')}
      linkLabel={t('auth.alreadyHaveAccount')}
      linkTo='/auth/v2/sign-in'
      linkText={t('auth.signIn')}
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
      <RegisterForm />
    </AuthCard>
  );
}

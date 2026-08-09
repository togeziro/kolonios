import { createFileRoute } from '@tanstack/react-router';
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
      <UserAuthForm />
    </AuthCard>
  );
}

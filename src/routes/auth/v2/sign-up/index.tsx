import { createFileRoute } from '@tanstack/react-router';
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
      <RegisterForm />
    </AuthCard>
  );
}

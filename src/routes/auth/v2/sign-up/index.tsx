import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import AuthCard from '@/features/auth/components/auth-card';
import RegisterForm from '@/features/auth/components/register-form';
import { BrandPanelPattern, V2BrandHeader } from './-brand-panel';

export const Route = createFileRoute('/auth/v2/sign-up/')({
  head: () => ({
    meta: [{ title: 'Sign Up - V2' }]
  }),
  component: SignUpV2Page
});

function SignUpV2Page() {
  const { t } = useTranslation();
  return (
    <main>
      <div className='grid min-h-dvh justify-center p-2 lg:grid-cols-2'>
        <div className='relative order-2 hidden h-full min-h-[480px] rounded-3xl bg-primary lg:flex'>
          <V2BrandHeader />
          <BrandPanelPattern />
        </div>
        <div className='relative order-1 flex min-h-[480px] flex-col lg:min-h-dvh'>
          <AuthCard
            title={t('auth.createAccountTitle')}
            subtitle={t('auth.createAccountSubtitle')}
            linkLabel={t('auth.alreadyHaveAccount')}
            linkTo='/auth/v2/sign-in'
            linkText={t('auth.signIn')}
          >
            <RegisterForm />
          </AuthCard>
        </div>
      </div>
    </main>
  );
}

/**
 * Sign-up owns its layout (split-screen with brand panel). Sign-in uses a
 * different full-bleed layout, so there is no shared /auth/v2 parent.
 */

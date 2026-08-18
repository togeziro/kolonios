import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { RateLimitSettingsCard } from '@/features/rate-limit-settings/components/rate-limit-settings-card';

export const Route = createFileRoute('/dashboard/admin/rate-limit')({
  component: RateLimitSettingsPage
});

function RateLimitSettingsPage() {
  const { t } = useTranslation();

  return (
    <PageContainer
      pageTitle={t('rateLimitSettings.title')}
      pageDescription={t('rateLimitSettings.pageDescription')}
    >
      <div className='max-w-3xl'>
        <RateLimitSettingsCard />
      </div>
    </PageContainer>
  );
}

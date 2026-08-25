import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import SettingsPage from '@/features/profile/components/settings-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/settings')({
  head: () => ({ meta: [{ title: 'Dashboard: Settings' }] }),
  component: SettingsRoute
});

function SettingsRoute() {
  const { t } = useTranslation();
  return (
    <PageContainer pageTitle={t('settingsPage.title')}>
      <SettingsPage />
    </PageContainer>
  );
}

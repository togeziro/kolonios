import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { WorklogSettingsCard } from '@/features/worklog-settings/components/worklog-settings-card';

export const Route = createFileRoute('/dashboard/admin/worklog-settings')({
  component: WorklogSettingsPage
});

function WorklogSettingsPage() {
  const { t } = useTranslation();

  return (
    <PageContainer
      pageTitle={t('worklogSettings.title')}
      pageDescription={t('worklogSettings.pageDescription')}
    >
      <div className='max-w-3xl'>
        <WorklogSettingsCard />
      </div>
    </PageContainer>
  );
}

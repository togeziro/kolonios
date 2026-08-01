import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DesignationManagePage from '@/features/masterdata/components/designation-manage-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/designations')({
  head: () => ({ meta: [{ title: 'Dashboard: Job Titles' }] }),
  component: DesignationsPage
});

function DesignationsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('masterdata.jobTitlesPageTitle')}
      pageDescription={t('masterdata.jobTitlesPageDescription')}
    >
      <DesignationManagePage />
    </PageContainer>
  );
}

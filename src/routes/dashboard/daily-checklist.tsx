import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DailyChecklistPage from '@/features/checklist/components/daily-checklist-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/daily-checklist')({
  head: () => ({ meta: [{ title: 'Dashboard: Daily Checklist' }] }),
  component: DailyChecklistDashboardPage
});

function DailyChecklistDashboardPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('checklist.pageTitle')}
      pageDescription={t('checklist.pageDescription')}
    >
      <DailyChecklistPage />
    </PageContainer>
  );
}

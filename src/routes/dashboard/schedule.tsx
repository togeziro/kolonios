import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import MySchedulePage from '@/features/schedule/components/my-schedule-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/schedule')({
  head: () => ({ meta: [{ title: 'Dashboard: Schedule' }] }),
  component: ScheduleDashboardPage
});

function ScheduleDashboardPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('schedule.pageTitle')}
      pageDescription={t('schedule.pageDescription')}
    >
      <MySchedulePage />
    </PageContainer>
  );
}

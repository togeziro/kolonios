import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import LeavePage from '@/features/attendance/components/leave-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/leave/')({
  head: () => ({ meta: [{ title: 'Dashboard: Leave' }] }),
  component: LeaveDashboardPage
});

function LeaveDashboardPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('attendance.leavePageTitle')}
      pageDescription={t('attendance.leavePageDescription')}
    >
      <LeavePage />
    </PageContainer>
  );
}

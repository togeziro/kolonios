import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import AttendancePage from '@/features/attendance/components/attendance-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/attendance/')({
  head: () => ({ meta: [{ title: 'Dashboard: Attendance' }] }),
  component: AttendanceDashboardPage
});

function AttendanceDashboardPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('attendance.pageTitle')}
      pageDescription={t('attendance.pageDescription')}
    >
      <AttendancePage />
    </PageContainer>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { ScheduleForm } from '@/features/attendance/components/admin-schedule-form';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/attendance/schedules')({
  head: () => ({ meta: [{ title: 'Dashboard: Attendance Schedules' }] }),
  component: SchedulesPage
});

function SchedulesPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('attendanceAdmin.schedulesTitle')}
      pageDescription={t('attendanceAdmin.schedulesDescription')}
    >
      <ScheduleForm />
    </PageContainer>
  );
}

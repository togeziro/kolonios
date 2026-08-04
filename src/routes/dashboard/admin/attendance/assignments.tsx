import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { ScheduleAssignmentForm } from '@/features/attendance/components/schedule-assignment-form';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/attendance/assignments')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'attendance.edit' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Attendance Assignments' }] }),
  component: AssignmentsPage
});

function AssignmentsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('attendanceAdmin.assignmentsTitle')}
      pageDescription={t('attendanceAdmin.assignmentsDescription')}
    >
      <ScheduleAssignmentForm />
    </PageContainer>
  );
}

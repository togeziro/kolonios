import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { ShiftListing } from '@/features/attendance/components/shift-listing';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/attendance/schedules')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'attendance_admin.edit' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Shift Master' }] }),
  component: SchedulesPage
});

function SchedulesPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('attendanceAdmin.shiftsTitle')}
      pageDescription={t('attendanceAdmin.shiftsDescription')}
    >
      <ShiftListing />
    </PageContainer>
  );
}

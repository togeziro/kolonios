import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { ScheduleGridPage } from '@/features/schedule-grid/components/schedule-grid-page';

export const Route = createFileRoute('/dashboard/admin/attendance/schedule-grid')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'attendance_admin.edit' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Schedule Grid' }] }),
  component: ScheduleGridRoute
});

function ScheduleGridRoute() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('scheduleGrid.title')}
      pageDescription={t('scheduleGrid.description')}
    >
      <ScheduleGridPage />
    </PageContainer>
  );
}

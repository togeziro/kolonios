import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { AdminAttendanceReport } from '@/features/attendance/components/admin-attendance-report';

export const Route = createFileRoute('/dashboard/admin/attendance/reports')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'attendance.edit' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Attendance Reports' }] }),
  component: ReportsPage
});

function ReportsPage() {
  return (
    <PageContainer>
      <AdminAttendanceReport />
    </PageContainer>
  );
}

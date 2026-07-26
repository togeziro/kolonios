import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import AttendancePage from '@/features/attendance/components/attendance-page';

export const Route = createFileRoute('/dashboard/attendance/')({
  head: () => ({ meta: [{ title: 'Dashboard: Attendance' }] }),
  component: () => (
    <PageContainer
      pageTitle='Attendance'
      pageDescription='Check in and out, view your attendance history'
    >
      <AttendancePage />
    </PageContainer>
  )
});

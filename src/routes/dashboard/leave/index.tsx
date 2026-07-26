import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import LeavePage from '@/features/attendance/components/leave-page';

export const Route = createFileRoute('/dashboard/leave/')({
  head: () => ({ meta: [{ title: 'Dashboard: Leave' }] }),
  component: () => (
    <PageContainer pageTitle='Leave Management' pageDescription='Submit and track leave requests'>
      <LeavePage />
    </PageContainer>
  )
});

import { createFileRoute } from '@tanstack/react-router';
import MyWorkPage from '@/features/tickets/components/my-work-page';

export const Route = createFileRoute('/dashboard/my-work/')({
  head: () => ({ meta: [{ title: 'Dashboard: My Work' }] }),
  component: () => <MyWorkPage />
});

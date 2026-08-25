import { createFileRoute } from '@tanstack/react-router';
import ReviewQueuePage from '@/features/spv/components/review-queue-page';

export const Route = createFileRoute('/dashboard/spv/review/')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'checklist.approve' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: SPV Review Queue' }] }),
  component: ReviewQueuePage
});

import { createFileRoute } from '@tanstack/react-router';
import LeaveApprovalsPage from '@/features/spv/components/leave-approvals-page';

export const Route = createFileRoute('/dashboard/spv/leave-approvals')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'spv_review.view' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Leave Approvals' }] }),
  component: LeaveApprovalsPage
});

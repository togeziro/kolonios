import { createFileRoute, useParams } from '@tanstack/react-router';
import ReviewTicketPage from '@/features/spv/components/review-ticket-page';

export const Route = createFileRoute('/dashboard/spv/review/$ticketId')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'checklist.approve' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: SPV Review Ticket' }] }),
  component: ReviewTicketRoute
});

function ReviewTicketRoute() {
  const { ticketId } = useParams({ from: Route.id });
  const parsed = Number(ticketId);
  const valid = Number.isInteger(parsed) && parsed > 0;
  return <ReviewTicketPage ticketId={valid ? parsed : undefined} />;
}

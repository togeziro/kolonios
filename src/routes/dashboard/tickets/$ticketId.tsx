import { createFileRoute, useParams } from '@tanstack/react-router';
import TicketDetailPage from '@/features/tickets/components/ticket-detail-page';

export const Route = createFileRoute('/dashboard/tickets/$ticketId')({
  head: () => ({ meta: [{ title: 'Dashboard: Ticket' }] }),
  component: TicketDetailRoute
});

function TicketDetailRoute() {
  const { ticketId } = useParams({ from: Route.id });
  const parsed = Number(ticketId);
  const valid = Number.isInteger(parsed) && parsed > 0;
  return <TicketDetailPage ticketId={valid ? parsed : 0} />;
}

import { createFileRoute, useParams } from '@tanstack/react-router';
import TicketCompletedPage from '@/features/tickets/components/ticket-completed-page';

export const Route = createFileRoute('/dashboard/tickets/$ticketId/completed')({
  head: () => ({ meta: [{ title: 'Dashboard: Ticket Completed' }] }),
  component: TicketCompletedRoute
});

function TicketCompletedRoute() {
  const { ticketId } = useParams({ from: Route.id });
  const parsed = Number(ticketId);
  const valid = Number.isInteger(parsed) && parsed > 0;
  return <TicketCompletedPage ticketId={valid ? parsed : 0} />;
}

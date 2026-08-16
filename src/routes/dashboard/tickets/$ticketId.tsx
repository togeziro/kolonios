import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/tickets/$ticketId')({
  head: () => ({ meta: [{ title: 'Dashboard: Ticket' }] }),
  component: TicketDetailLayout
});

function TicketDetailLayout() {
  return <Outlet />;
}

import { createFileRoute } from '@tanstack/react-router';
import CreateTicketForm from '@/features/tickets/components/create-ticket-form';

export const Route = createFileRoute('/dashboard/tickets/new')({
  head: () => ({ meta: [{ title: 'Dashboard: New Ticket' }] }),
  component: () => <CreateTicketForm />
});

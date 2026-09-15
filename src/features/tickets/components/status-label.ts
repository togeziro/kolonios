import type { TicketStatus } from '../api/types';

export const ticketStatusLabelKey: Record<TicketStatus, string> = {
  open: 'ticket.status.open',
  assigned: 'ticket.status.assigned',
  in_progress: 'ticket.status.inProgress',
  submitted: 'ticket.status.submitted',
  approved: 'ticket.status.approved',
  rejected: 'ticket.status.rejected',
  rework: 'ticket.status.rework',
  completed: 'ticket.status.completed',
  cancelled: 'ticket.status.cancelled'
};

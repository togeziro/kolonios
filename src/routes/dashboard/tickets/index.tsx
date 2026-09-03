import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import TicketListPage from '@/features/tickets/components/ticket-list-page';

const ticketsSearchSchema = z.object({
  status: z
    .enum([
      'open',
      'assigned',
      'in_progress',
      'submitted',
      'approved',
      'rejected',
      'rework',
      'completed',
      'cancelled'
    ])
    .optional()
});

export const Route = createFileRoute('/dashboard/tickets/')({
  validateSearch: zodValidator(ticketsSearchSchema),
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'tickets.view' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Tickets' }] }),
  component: TicketListPage
});

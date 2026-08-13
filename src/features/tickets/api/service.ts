import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { ticketIdSchema, listOpenTicketsSchema, createTicketSchema } from './validation';

export const getMyTicketsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('my_work', 'view');
  await checkRateLimit(`tickets:${session.user.id}`);
  const { getMyTickets } = await import('@/lib/db/tickets');
  return getMyTickets(session.user.id);
});

export const listOpenTicketsFn = createServerFn({ method: 'GET' })
  .validator(listOpenTicketsSchema)
  .handler(async ({ data: filters }) => {
    const session = await requirePermission('jobs', 'view');
    await checkRateLimit(`tickets:${session.user.id}`);
    const { listOpenTickets } = await import('@/lib/db/tickets');
    return listOpenTickets(session.user.id, filters);
  });

export const getTicketDetailFn = createServerFn({ method: 'GET' })
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('my_work', 'view');
    const { getTicketDetail } = await import('@/lib/db/tickets');
    return getTicketDetail(session.user.id, data.ticketId);
  });

export const takeTicketFn = createServerFn({ method: 'POST' })
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('jobs', 'view');
    await checkRateLimit(`write:${session.user.id}`);
    const { takeTicket } = await import('@/lib/db/tickets');
    return takeTicket(session.user.id, data.ticketId);
  });

export const completeTicketFn = createServerFn({ method: 'POST' })
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('my_work', 'view');
    await checkRateLimit(`write:${session.user.id}`);
    const { completeTicket } = await import('@/lib/db/tickets');
    return completeTicket(session.user.id, data.ticketId);
  });

export const createTicketFn = createServerFn({ method: 'POST' })
  .validator(createTicketSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'view');
    await checkRateLimit(`write:${session.user.id}`);
    const { createTicket } = await import('@/lib/db/tickets');
    return createTicket(session.user.id, data);
  });

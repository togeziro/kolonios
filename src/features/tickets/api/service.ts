import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  ticketIdSchema,
  listOpenTicketsSchema,
  listTicketsSchema,
  createTicketSchema,
  legIdSchema,
  arriveTicketSchema,
  submitWorkSessionSchema,
  submitHandoffNoteSchema,
  reviewTicketSchema
} from './validation';

export const getMyTicketsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('my_work', 'view');
  await checkRateLimit(`tickets:${session.user.id}`);
  const { getMyTickets } = await import('@/lib/db/tickets');
  return getMyTickets(session.user.id);
});

export const getCompletedTicketsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('my_work', 'view');
  await checkRateLimit(`tickets:${session.user.id}`);
  const { getCompletedTickets } = await import('@/lib/db/tickets');
  return getCompletedTickets(session.user.id);
});

export const listOpenTicketsFn = createServerFn({ method: 'GET' })
  .validator(listOpenTicketsSchema)
  .handler(async ({ data: filters }) => {
    const session = await requirePermission('jobs', 'view');
    await checkRateLimit(`tickets:${session.user.id}`);
    const { listOpenTickets } = await import('@/lib/db/tickets');
    return listOpenTickets(session.user.id, filters);
  });

export const listTicketsFn = createServerFn({ method: 'GET' })
  .validator(listTicketsSchema)
  .handler(async ({ data: filters }) => {
    const session = await requirePermission('tickets', 'view');
    await checkRateLimit(`tickets:${session.user.id}`);
    const { listTickets } = await import('@/lib/db/tickets');
    return listTickets(session.user.id, filters);
  });

export const getTicketDetailFn = createServerFn({ method: 'GET' })
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'view');
    const { getTicketDetail } = await import('@/lib/db/tickets');
    return getTicketDetail(session.user.id, data.ticketId);
  });

export const takeTicketFn = createServerFn({ method: 'POST' })
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { takeTicket } = await import('@/lib/db/tickets');
    return takeTicket(session.user.id, data.ticketId);
  });

export const claimLegFn = createServerFn({ method: 'POST' })
  .validator(legIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { claimLeg } = await import('@/lib/db/tickets');
    return claimLeg(session.user.id, data.legId);
  });

export const listRelayPoolFn = createServerFn({ method: 'GET' })
  .validator(listOpenTicketsSchema)
  .handler(async ({ data: filters }) => {
    const session = await requirePermission('jobs', 'view');
    await checkRateLimit(`tickets:${session.user.id}`);
    const { listRelayPool } = await import('@/lib/db/tickets');
    return listRelayPool(session.user.id, filters);
  });

export const completeTicketFn = createServerFn({ method: 'POST' })
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    // Field tickets must go via Work Session → submitted → SPV review → completed.
    // Direct Mark Complete is blocked for non-admin field tickets (server guard, not just UI).
    const { db } = await import('@/lib/db');
    const { tickets } = await import('@/lib/db/schema/tickets');
    const { eq } = await import('drizzle-orm');
    const { FIELD_TASK_TYPES } = await import('@/lib/tickets/engine');
    const { getUserRoleGroup } = await import('@/lib/db/role-groups');
    const [row] = await db
      .select({ taskType: tickets.task_type })
      .from(tickets)
      .where(eq(tickets.id, data.ticketId))
      .limit(1);
    if (row) {
      const isField = (FIELD_TASK_TYPES as readonly string[]).includes(row.taskType);
      if (isField) {
        const rg = await getUserRoleGroup(session.user.id);
        const isAdmin = rg?.is_admin === true;
        if (!isAdmin) {
          return {
            success: false as const,
            message: 'Field tickets must be submitted via Work Session for SPV review'
          };
        }
      }
    }
    const { completeTicket } = await import('@/lib/db/tickets');
    return completeTicket(session.user.id, data.ticketId);
  });

export const createTicketFn = createServerFn({ method: 'POST' })
  .validator(createTicketSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'add');
    await checkRateLimit(`write:${session.user.id}`);
    const { createTicket } = await import('@/lib/db/tickets');
    return createTicket(session.user.id, data);
  });

export const startLegFn = createServerFn({ method: 'POST' })
  .validator(legIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { startLeg } = await import('@/lib/db/tickets');
    return startLeg(session.user.id, data.legId);
  });

export const arriveTicketFn = createServerFn({ method: 'POST' })
  .validator(arriveTicketSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { arriveTicket } = await import('@/lib/db/tickets');
    return arriveTicket(
      session.user.id,
      data.ticketId,
      data.latitude != null && data.longitude != null
        ? { latitude: data.latitude, longitude: data.longitude, accuracy: data.accuracy ?? 0 }
        : undefined
    );
  });

export const submitWorkSessionFn = createServerFn({ method: 'POST' })
  .validator(submitWorkSessionSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { submitWorkSession } = await import('@/lib/db/tickets');
    return submitWorkSession(session.user.id, data.ticketId, {
      materials: data.materials,
      photos: data.photos,
      notes: data.notes,
      log: data.log
    });
  });

export const submitHandoffNoteFn = createServerFn({ method: 'POST' })
  .validator(submitHandoffNoteSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('tickets', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { addHandoffNote } = await import('@/lib/db/tickets');
    return addHandoffNote(session.user.id, data.legId, data.note);
  });

export const listSubmittedTicketsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('spv_review', 'view');
  await checkRateLimit(`tickets:${session.user.id}`);
  const { listSubmittedTickets } = await import('@/lib/db/tickets');
  return listSubmittedTickets();
});

export const reviewTicketFn = createServerFn({ method: 'POST' })
  .validator(reviewTicketSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('spv_review', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { reviewTicket } = await import('@/lib/db/tickets');
    return reviewTicket(session.user.id, data.ticketId, data.decision, data.notes);
  });

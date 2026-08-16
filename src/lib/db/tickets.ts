import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { buildConditions } from './utils';
import {
  tickets,
  ticketLegs,
  ticketMaterials,
  ticketPhotos,
  ticketWorklog,
  taskRequirements,
  employeeSkills
} from './schema/tickets';
import { employees } from './schema/employees';
import { customers } from './schema/customers';
import { locations } from './schema/attendance';
import type {
  Ticket,
  TicketDetail,
  TicketLeg,
  TicketMaterial,
  TicketPhoto,
  TicketWorklog,
  TicketListFilters,
  TicketListResponse,
  TicketDetailResponse,
  TicketActionResponse,
  CreateTicketResponse,
  NewTicketInput,
  TicketDomain,
  WorkSessionSubmitInput,
  WorkLogEntryInput,
  NextLegInfo
} from '@/features/tickets/api/types';

export const MAX_ACTIVE_TICKETS = 3;

const FIELD_TASK_TYPES = ['installation', 'maintenance', 'inspection'] as const;

type TicketRow = typeof tickets.$inferSelect;
type RequirementRow = typeof taskRequirements.$inferSelect;
type LegRow = typeof ticketLegs.$inferSelect;

function domainOf(taskType: string): TicketDomain {
  return (FIELD_TASK_TYPES as readonly string[]).includes(taskType) ? 'field' : 'backoffice';
}

async function loadRequirements(ticketId: number): Promise<RequirementRow[]> {
  return db.select().from(taskRequirements).where(eq(taskRequirements.task_id, ticketId));
}

async function loadCustomer(customerId: string | null) {
  if (!customerId) return null;
  const [customer] = await db
    .select({ id: customers.id, name: customers.full_name })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  return customer ?? null;
}

async function loadLocation(locationId: number | null) {
  if (locationId == null) return null;
  const [location] = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);
  return location ?? null;
}

async function toTicket(row: TicketRow, reqs: RequirementRow[]): Promise<Ticket> {
  const [customer, location] = await Promise.all([
    loadCustomer(row.customer_id),
    loadLocation(row.location_id)
  ]);
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    title: row.title,
    description: row.description,
    channel: row.channel,
    customer,
    assetName: row.asset_name,
    taskType: row.task_type,
    domain: domainOf(row.task_type),
    status: row.status,
    priority: row.priority,
    location,
    dueAt: row.due_at ? row.due_at.toISOString() : null,
    estimatedMinutes: row.estimated_minutes,
    requiredSkills: reqs.map((r) => r.skill).filter((s): s is string => s != null),
    assignedTo: row.assigned_to,
    takenBy: row.taken_by,
    takenAt: row.taken_at ? row.taken_at.toISOString() : null,
    rating: row.rating ?? null,
    reviewNote: row.review_note || null,
    reviewedBy: row.reviewed_by,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null
  };
}

function toLeg(row: LegRow): TicketLeg {
  return {
    id: row.id,
    legNumber: row.leg_number,
    name: row.name,
    description: row.description,
    status: row.status,
    assigneeId: row.assignee_id,
    takenAt: row.taken_at ? row.taken_at.toISOString() : null,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    notes: row.notes
  };
}

async function loadLegs(ticketId: number): Promise<TicketLeg[]> {
  const rows = await db
    .select()
    .from(ticketLegs)
    .where(eq(ticketLegs.ticket_id, ticketId))
    .orderBy(asc(ticketLegs.leg_number));
  return rows.map(toLeg);
}

async function loadMaterials(ticketId: number): Promise<TicketMaterial[]> {
  const rows = await db
    .select({
      material: ticketMaterials,
      legName: ticketLegs.name,
      legNumber: ticketLegs.leg_number
    })
    .from(ticketMaterials)
    .innerJoin(ticketLegs, eq(ticketMaterials.leg_id, ticketLegs.id))
    .where(eq(ticketLegs.ticket_id, ticketId))
    .orderBy(asc(ticketLegs.leg_number));
  return rows.map(({ material, legName }) => ({
    id: material.id,
    legId: material.leg_id,
    legName,
    materialName: material.material_name,
    qty: material.qty,
    unit: material.unit,
    source: material.source,
    barcode: material.barcode
  }));
}

async function loadPhotos(ticketId: number): Promise<TicketPhoto[]> {
  const rows = await db
    .select({
      id: ticketPhotos.id,
      legId: ticketPhotos.leg_id,
      fileUrl: ticketPhotos.file_url,
      caption: ticketPhotos.caption
    })
    .from(ticketPhotos)
    .innerJoin(ticketLegs, eq(ticketPhotos.leg_id, ticketLegs.id))
    .where(eq(ticketLegs.ticket_id, ticketId))
    .orderBy(asc(ticketPhotos.id));
  return rows;
}

function toWorklog(row: typeof ticketWorklog.$inferSelect): TicketWorklog {
  return {
    id: row.id,
    legId: row.leg_id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by
  };
}

async function loadWorklog(ticketId: number): Promise<TicketWorklog[]> {
  const rows = await db
    .select()
    .from(ticketWorklog)
    .innerJoin(ticketLegs, eq(ticketWorklog.leg_id, ticketLegs.id))
    .where(eq(ticketLegs.ticket_id, ticketId))
    .orderBy(asc(ticketWorklog.id));
  return rows.map(({ ticket_worklog }) => toWorklog(ticket_worklog));
}

async function getEligibilityProfile(userId: string) {
  const [employee, skillRows] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, userId)).limit(1),
    db
      .select({ skill: employeeSkills.skill })
      .from(employeeSkills)
      .where(eq(employeeSkills.user_id, userId))
  ]);
  return {
    employee: employee[0] ?? null,
    skills: skillRows.map((r) => r.skill)
  };
}

function unmetReasons(
  reqs: RequirementRow[],
  profile: Awaited<ReturnType<typeof getEligibilityProfile>>
): string[] {
  const reasons: string[] = [];
  if (profile.employee?.status !== 'active') {
    reasons.push('Your account is not active');
  }
  for (const r of reqs) {
    if (r.department_id != null && profile.employee?.department_id !== r.department_id) {
      reasons.push('Requires a different department');
    }
    if (r.designation_id != null && profile.employee?.designation_id !== r.designation_id) {
      reasons.push('Requires a different designation');
    }
    if (r.location_id != null && profile.employee?.location_id !== r.location_id) {
      reasons.push('Outside your assigned location');
    }
    if (r.skill != null && !profile.skills.includes(r.skill)) {
      reasons.push(`Requires skill: ${r.skill}`);
    }
  }
  return [...new Set(reasons)];
}

function isMine(userId: string): ReturnType<typeof sql> {
  return sql`(${tickets.assigned_to} = ${userId} OR ${tickets.taken_by} = ${userId})`;
}

export async function listOpenTickets(
  userId: string,
  filters: TicketListFilters = {}
): Promise<TicketListResponse> {
  try {
    const profile = await getEligibilityProfile(userId);

    const where = buildConditions([
      eq(tickets.status, 'open'),
      filters.domain != null
        ? filters.domain === 'field'
          ? inArray(tickets.task_type, [...FIELD_TASK_TYPES])
          : notInArray(tickets.task_type, [...FIELD_TASK_TYPES])
        : undefined,
      filters.priority != null ? eq(tickets.priority, filters.priority) : undefined
    ]);

    const rows = await db.select().from(tickets).where(where).orderBy(desc(tickets.created_at));

    const eligible: TicketListResponse['tickets'] = [];
    const unavailable: TicketListResponse['unavailable'] = [];
    for (const row of rows) {
      const reqs = await loadRequirements(row.id);
      const ticket = await toTicket(row, reqs);
      const reasons = unmetReasons(reqs, profile);
      if (reasons.length === 0) {
        eligible.push(ticket);
      } else {
        unavailable.push({ ...ticket, eligibilityReasons: reasons });
      }
    }
    return { success: true, tickets: eligible, unavailable };
  } catch (e) {
    mapDbError(e, 'tickets.listOpenTickets');
  }
}

export async function getTicketDetail(
  _userId: string,
  ticketId: number
): Promise<TicketDetailResponse> {
  try {
    const [row] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    if (!row) return { success: false, message: 'Ticket not found' };
    const reqs = await loadRequirements(ticketId);
    const ticket = await toTicket(row, reqs);
    const detail: TicketDetail = {
      ...ticket,
      legs: await loadLegs(ticketId),
      materials: await loadMaterials(ticketId),
      photos: await loadPhotos(ticketId),
      worklog: await loadWorklog(ticketId),
      requesterId: row.requester_id,
      createdAt: row.created_at.toISOString()
    };
    return { success: true, ticket: detail };
  } catch (e) {
    mapDbError(e, 'tickets.getTicketDetail');
  }
}

export async function createTicket(
  userId: string,
  input: NewTicketInput
): Promise<CreateTicketResponse> {
  try {
    const legs = input.legs?.length ? input.legs : [{ name: input.title }];
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .insert(tickets)
        .values({
          title: input.title,
          description: input.description ?? '',
          channel: input.channel ?? 'field',
          requester_id: userId,
          customer_id: input.customerId,
          asset_name: input.assetName ?? '',
          task_type: input.taskType ?? 'installation',
          priority: input.priority ?? 'medium',
          location_id: input.locationId,
          due_at: input.dueAt ? new Date(input.dueAt) : null,
          estimated_minutes: input.estimatedMinutes,
          created_by: userId
        })
        .returning();
      await tx
        .update(tickets)
        .set({ ticket_code: `T-${ticket.id}`, updated_at: new Date() })
        .where(eq(tickets.id, ticket.id));
      await tx.insert(ticketLegs).values(
        legs.map((leg, index) => ({
          ticket_id: ticket.id,
          leg_number: index + 1,
          name: leg.name,
          description: leg.description ?? ''
        }))
      );
      return ticket.id;
    });
    const [row] = await db.select().from(tickets).where(eq(tickets.id, result)).limit(1);
    if (!row) return { success: false, message: 'Ticket not found' };
    const reqs = await loadRequirements(row.id);
    const ticket = await toTicket(row, reqs);
    return {
      success: true,
      ticket: {
        ...ticket,
        legs: await loadLegs(row.id),
        materials: await loadMaterials(row.id),
        photos: await loadPhotos(row.id),
        worklog: await loadWorklog(row.id),
        requesterId: row.requester_id,
        createdAt: row.created_at.toISOString()
      }
    };
  } catch (e) {
    mapDbError(e, 'tickets.createTicket');
  }
}

export async function takeTicket(userId: string, ticketId: number): Promise<TicketActionResponse> {
  try {
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.status, 'open')))
        .limit(1);
      if (!ticket) return { success: false, message: 'Ticket is no longer available' };

      const profile = await getEligibilityProfile(userId);
      const reqs = await loadRequirements(ticketId);
      const reasons = unmetReasons(reqs, profile);
      if (reasons.length > 0) {
        return { success: false, message: `Not eligible: ${reasons.join(', ')}` };
      }

      // Serialize concurrent claims by the same user on the user's own employees
      // row: a concurrent takeTicket for a different ticket must block here until
      // this transaction commits, so the capacity re-count below sees the
      // just-claimed ticket. (Locking the user's active ticket rows is not enough:
      // under READ COMMITTED a blocked SELECT FOR UPDATE keeps its statement-start
      // snapshot, so a ticket claimed concurrently on another row stays invisible
      // to the re-count.)
      await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, userId))
        .for('update')
        .limit(1);

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tickets)
        .where(and(inArray(tickets.status, ['assigned', 'in_progress']), isMine(userId)));
      if (count >= MAX_ACTIVE_TICKETS) {
        return {
          success: false,
          message: `Active ticket limit reached (${MAX_ACTIVE_TICKETS})`
        };
      }

      const [claimed] = await tx
        .update(tickets)
        .set({
          status: 'assigned',
          taken_by: userId,
          taken_at: new Date(),
          updated_at: new Date()
        })
        .where(and(eq(tickets.id, ticketId), eq(tickets.status, 'open')))
        .returning();
      if (!claimed) return { success: false, message: 'Ticket is no longer available' };

      return { success: true, message: 'Ticket taken', ticket: await toTicket(claimed, reqs) };
    });
    return result;
  } catch (e) {
    mapDbError(e, 'tickets.takeTicket');
  }
}

export async function startLeg(userId: string, legId: number): Promise<TicketActionResponse> {
  try {
    const [leg] = await db.select().from(ticketLegs).where(eq(ticketLegs.id, legId)).limit(1);
    if (!leg) return { success: false, message: 'Leg not found' };

    const [ticket] = await db
      .select({ id: tickets.id, status: tickets.status })
      .from(tickets)
      .where(and(eq(tickets.id, leg.ticket_id), isMine(userId)))
      .limit(1);
    if (!ticket) return { success: false, message: 'You can only start legs of tickets you took' };

    if (!['open', 'assigned'].includes(leg.status)) {
      return { success: false, message: 'Leg can only be started from open or assigned' };
    }

    const [updated] = await db
      .update(ticketLegs)
      .set({
        status: 'in_progress',
        assignee_id: userId,
        taken_at: new Date(),
        updated_at: new Date()
      })
      .where(and(eq(ticketLegs.id, legId), inArray(ticketLegs.status, ['open', 'assigned'])))
      .returning();
    if (!updated) return { success: false, message: 'Leg is no longer startable' };

    if (ticket.status === 'assigned') {
      await db
        .update(tickets)
        .set({ status: 'in_progress', updated_at: new Date() })
        .where(eq(tickets.id, ticket.id));
    }
    return { success: true, message: 'Leg started' };
  } catch (e) {
    mapDbError(e, 'tickets.startLeg');
  }
}

export async function getMyTickets(userId: string): Promise<TicketListResponse> {
  try {
    const rows = await db
      .select()
      .from(tickets)
      .where(and(inArray(tickets.status, ['assigned', 'in_progress', 'submitted']), isMine(userId)))
      .orderBy(desc(tickets.created_at));

    const result: Ticket[] = [];
    for (const row of rows) {
      result.push(await toTicket(row, await loadRequirements(row.id)));
    }
    return { success: true, tickets: result, unavailable: [] };
  } catch (e) {
    mapDbError(e, 'tickets.getMyTickets');
  }
}

export async function getCompletedTickets(userId: string): Promise<TicketListResponse> {
  try {
    const rows = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.status, 'completed'), isMine(userId)))
      .orderBy(desc(tickets.completed_at), desc(tickets.created_at));

    const result: Ticket[] = [];
    for (const row of rows) {
      result.push(await toTicket(row, await loadRequirements(row.id)));
    }
    return { success: true, tickets: result, unavailable: [] };
  } catch (e) {
    mapDbError(e, 'tickets.getCompletedTickets');
  }
}

export async function completeTicket(
  userId: string,
  ticketId: number
): Promise<TicketActionResponse> {
  try {
    const [ticket] = await db
      .update(tickets)
      .set({ status: 'completed', completed_at: new Date(), updated_at: new Date() })
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(tickets.taken_by, userId),
          eq(tickets.status, 'in_progress')
        )
      )
      .returning();
    if (!ticket) return { success: false, message: 'Ticket not found or not in progress by you' };

    await db
      .update(ticketLegs)
      .set({ status: 'completed', completed_at: new Date(), updated_at: new Date() })
      .where(
        and(
          eq(ticketLegs.ticket_id, ticketId),
          inArray(ticketLegs.status, ['open', 'assigned', 'in_progress'])
        )
      );

    return {
      success: true,
      message: 'Ticket completed',
      ticket: await toTicket(ticket, await loadRequirements(ticket.id))
    };
  } catch (e) {
    mapDbError(e, 'tickets.completeTicket');
  }
}

export async function submitWorkSession(
  userId: string,
  ticketId: number,
  input: WorkSessionSubmitInput
): Promise<TicketActionResponse> {
  try {
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, ticketId),
            eq(tickets.taken_by, userId),
            eq(tickets.status, 'in_progress')
          )
        )
        .limit(1);
      if (!ticket) return { success: false, message: 'Ticket not found or not in progress by you' };

      const legs = await tx
        .select()
        .from(ticketLegs)
        .where(eq(ticketLegs.ticket_id, ticketId))
        .orderBy(
          sql`case when ${ticketLegs.status} = 'in_progress' then 0 else 1 end`,
          asc(ticketLegs.leg_number)
        )
        .limit(1);
      const leg = legs[0];
      if (!leg) return { success: false, message: 'Ticket has no legs' };

      if (input.materials.length > 0) {
        await tx.insert(ticketMaterials).values(
          input.materials.map((m) => ({
            leg_id: leg.id,
            material_name: m.name,
            qty: m.qty,
            unit: m.unit,
            source: m.source,
            barcode: ''
          }))
        );
      }

      if (input.photos.length > 0) {
        await tx.insert(ticketPhotos).values(
          input.photos.map((p) => ({
            leg_id: leg.id,
            file_url: p.fileUrl,
            caption: '',
            uploader_id: userId
          }))
        );
      }

      if (input.log.length > 0) {
        await tx.insert(ticketWorklog).values(
          input.log.map((entry) => ({
            leg_id: leg.id,
            kind: entry.kind,
            body: entry.body,
            created_by: userId
          }))
        );
      }

      await tx
        .update(ticketLegs)
        .set({
          status: 'submitted',
          completed_at: new Date(),
          notes: input.notes,
          updated_at: new Date()
        })
        .where(eq(ticketLegs.id, leg.id));

      const nextLegs = await tx
        .select()
        .from(ticketLegs)
        .where(
          and(
            eq(ticketLegs.ticket_id, ticketId),
            sql`${ticketLegs.leg_number} > ${leg.leg_number}`,
            inArray(ticketLegs.status, ['open', 'assigned'])
          )
        )
        .orderBy(asc(ticketLegs.leg_number))
        .limit(1);
      const nextLeg = nextLegs[0] ?? null;

      if (nextLeg) {
        await tx
          .update(ticketLegs)
          .set({ status: 'assigned', updated_at: new Date() })
          .where(eq(ticketLegs.id, nextLeg.id));
      } else {
        await tx
          .update(tickets)
          .set({
            status: 'completed',
            completed_at: new Date(),
            updated_at: new Date()
          })
          .where(eq(tickets.id, ticketId));
      }

      return {
        success: true,
        message: 'Work session submitted',
        nextLeg: nextLeg ? { legNumber: nextLeg.leg_number, name: nextLeg.name } : null,
        isLastLeg: !nextLeg
      };
    });
    if (!result.success) return result;
    const [row] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    if (!row) return { success: false, message: 'Ticket not found' };
    return {
      ...result,
      ticket: await toTicket(row, await loadRequirements(ticketId))
    };
  } catch (e) {
    mapDbError(e, 'tickets.submitWorkSession');
  }
}

export async function addHandoffNote(
  userId: string,
  legId: number,
  note: string
): Promise<TicketActionResponse> {
  try {
    const [leg] = await db.select().from(ticketLegs).where(eq(ticketLegs.id, legId)).limit(1);
    if (!leg) return { success: false, message: 'Leg not found' };

    const [ticket] = await db
      .select({ id: tickets.id, taken_by: tickets.taken_by })
      .from(tickets)
      .where(and(eq(tickets.id, leg.ticket_id), eq(tickets.taken_by, userId)))
      .limit(1);
    if (!ticket)
      return { success: false, message: 'You can only hand off legs of tickets you took' };

    if (leg.status !== 'submitted') {
      return { success: false, message: 'Only submitted legs can be handed off' };
    }

    await db
      .update(ticketLegs)
      .set({
        notes: leg.notes ? `${leg.notes}\nHandoff: ${note}` : `Handoff: ${note}`,
        updated_at: new Date()
      })
      .where(eq(ticketLegs.id, leg.id));

    return { success: true, message: 'Handoff note added' };
  } catch (e) {
    mapDbError(e, 'tickets.addHandoffNote');
  }
}

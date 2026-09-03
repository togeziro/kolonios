import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
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
import { user } from './auth-schema';
// Domain types live in lib/domain; features re-export them for UI use.
// The DB layer must not depend on the feature layer.
import type {
  Ticket,
  TicketDetail,
  TicketLeg,
  TicketListFilters,
  TicketListResponse,
  TicketDetailResponse,
  TicketActionResponse,
  CreateTicketResponse,
  NewTicketInput,
  WorkSessionSubmitInput,
  RelayPoolResponse,
  RelayPoolItem,
  RelayPoolLeg,
  TicketLegInfo
} from '@/lib/domain/tickets';
import {
  MAX_ACTIVE_TICKETS,
  FIELD_TASK_TYPES,
  unmetRequirementReasons,
  ticketToDomain,
  legToDomain,
  materialToDomain,
  worklogToDomain,
  pickSubmittableLeg,
  resolveSubmittedNotes,
  resolveLegAdvance,
  pickClaimableLeg,
  formatHandoffNote,
  formatArrivalBody,
  type EligibilityProfile
} from '@/lib/tickets/engine';

export { MAX_ACTIVE_TICKETS };

type RequirementRow = typeof taskRequirements.$inferSelect;

class TicketClaimLostError extends Error {
  constructor() {
    super('Ticket moved out of in_progress during claim');
    this.name = 'TicketClaimLostError';
  }
}

async function loadRequirements(ticketId: number): Promise<RequirementRow[]> {
  return db.select().from(taskRequirements).where(eq(taskRequirements.task_id, ticketId));
}

async function loadRequirementsForTickets(
  ticketIds: number[]
): Promise<Map<number, RequirementRow[]>> {
  if (ticketIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(taskRequirements)
    .where(inArray(taskRequirements.task_id, ticketIds));
  return groupBy(rows, (row) => row.task_id);
}

async function loadCustomer(customerId: string | null) {
  if (!customerId) return null;
  const [customer] = await db
    .select({
      id: customers.id,
      name: customers.full_name,
      phone: customers.phone,
      address: customers.address,
      latitude: customers.latitude,
      longitude: customers.longitude
    })
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

async function toTicket(
  row: typeof tickets.$inferSelect,
  reqs: RequirementRow[],
  creatorName: string | null = null,
  takenByName: string | null = null
): Promise<Ticket> {
  const [customer, location] = await Promise.all([
    loadCustomer(row.customer_id),
    loadLocation(row.location_id)
  ]);
  return ticketToDomain(row, reqs, { customer, location, creatorName, takenByName });
}

function toLeg(row: typeof ticketLegs.$inferSelect): TicketLeg {
  return legToDomain(row);
}

async function loadLegs(ticketId: number): Promise<TicketLeg[]> {
  const rows = await db
    .select()
    .from(ticketLegs)
    .where(eq(ticketLegs.ticket_id, ticketId))
    .orderBy(asc(ticketLegs.leg_number));
  return rows.map(toLeg);
}

async function loadMaterials(ticketId: number) {
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
  return rows.map(({ material, legName }) => materialToDomain(material, legName));
}

async function loadPhotos(ticketId: number): Promise<TicketDetail['photos']> {
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

async function loadWorklog(ticketId: number) {
  const rows = await db
    .select()
    .from(ticketWorklog)
    .innerJoin(ticketLegs, eq(ticketWorklog.leg_id, ticketLegs.id))
    .where(eq(ticketLegs.ticket_id, ticketId))
    .orderBy(asc(ticketWorklog.id));
  return rows.map(({ ticket_worklog }) => worklogToDomain(ticket_worklog));
}

async function loadLegSummaries(ticketIds: number[]): Promise<Map<number, TicketLegInfo>> {
  if (ticketIds.length === 0) return new Map();
  const rows = await db
    .select({
      ticketId: ticketLegs.ticket_id
    })
    .from(ticketLegs)
    .where(inArray(ticketLegs.ticket_id, ticketIds));
  const counts = groupBy(rows, (row) => row.ticketId);
  const result = new Map<number, TicketLegInfo>();
  for (const [ticketId, list] of counts) {
    // Open tickets have no leg started yet, so the current leg is always 1.
    result.set(ticketId, { legNumber: 1, legsTotal: list.length });
  }
  return result;
}

async function getEligibilityProfile(userId: string): Promise<EligibilityProfile> {
  const [employee, skillRows] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, userId)).limit(1),
    db
      .select({ skill: employeeSkills.skill })
      .from(employeeSkills)
      .where(eq(employeeSkills.user_id, userId))
  ]);
  const row = employee[0] ?? null;
  return {
    status: row?.status ?? null,
    department_id: row?.department_id ?? null,
    designation_id: row?.designation_id ?? null,
    location_id: row?.location_id ?? null,
    skills: skillRows.map((r) => r.skill)
  };
}

function isMine(userId: string): ReturnType<typeof sql> {
  return sql`(${tickets.assigned_to} = ${userId} OR ${tickets.taken_by} = ${userId})`;
}

// Generic in-memory group-by used to bucket a flat row set by a key (used by the
// ticket/leg/requirement batch loaders below — they all do the same three-line
// Map dance, so it lives once here).
function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const buckets = new Map<number, T[]>();
  for (const row of rows) {
    const bucket = buckets.get(key(row)) ?? [];
    bucket.push(row);
    buckets.set(key(row), bucket);
  }
  return buckets;
}

const ACTIVE_TICKET_STATUSES = ['assigned', 'in_progress'] as const;

// Admin override: bypass the active-ticket cap. Fails closed — if the role-group
// lookup itself errors, the claim is rejected rather than silently counted as
// admin (which would let a non-admin skirt the cap).
async function isAdminUser(userId: string): Promise<boolean> {
  const { getUserRoleGroup } = await import('./role-groups');
  const group = await getUserRoleGroup(userId);
  return group?.is_admin === true;
}

// Enforces MAX_ACTIVE_TICKETS for non-admin callers. Returns a failure message
// (already localized by callers) when the cap is hit, or null when the caller
// may proceed. Admin users and the current ticket holder (re-claiming their own
// next leg — relay ganda) skip the cap entirely.
async function enforceActiveCap(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  opts: { skipForCurrentHolder?: boolean } = {}
): Promise<string | null> {
  if (opts.skipForCurrentHolder) return null;
  if (await isAdminUser(userId)) return null;
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(inArray(tickets.status, [...ACTIVE_TICKET_STATUSES]), isMine(userId)));
  if (count >= MAX_ACTIVE_TICKETS) {
    return `Active ticket limit reached (${MAX_ACTIVE_TICKETS})`;
  }
  return null;
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

    const rows = await db
      .select({
        ticket: tickets,
        creatorName: user.name
      })
      .from(tickets)
      .leftJoin(user, eq(tickets.created_by, user.id))
      .where(where)
      .orderBy(desc(tickets.created_at));

    const legSummaries = await loadLegSummaries(rows.map((r) => r.ticket.id));

    const eligible: TicketListResponse['tickets'] = [];
    const unavailable: TicketListResponse['unavailable'] = [];
    for (const row of rows) {
      const reqs = await loadRequirements(row.ticket.id);
      const ticket = await toTicket(row.ticket, reqs, row.creatorName ?? null);
      ticket.legInfo = legSummaries.get(row.ticket.id) ?? null;
      const reasons = unmetRequirementReasons(reqs, profile);
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

// Relay pool: in_progress tickets whose nearest next leg (assigned, assignee
// null) is unclaimed. Includes holder name, ticket header, and which leg is
// available. Mirrors listOpenTickets' eligible/unavailable split per caller.
export async function listRelayPool(
  userId: string,
  filters: TicketListFilters = {}
): Promise<RelayPoolResponse> {
  try {
    const profile = await getEligibilityProfile(userId);

    const where = buildConditions([
      eq(tickets.status, 'in_progress'),
      filters.domain != null
        ? filters.domain === 'field'
          ? inArray(tickets.task_type, [...FIELD_TASK_TYPES])
          : notInArray(tickets.task_type, [...FIELD_TASK_TYPES])
        : undefined,
      filters.priority != null ? eq(tickets.priority, filters.priority) : undefined
    ]);

    const rows = await db
      .select({
        ticket: tickets,
        takenByName: user.name
      })
      .from(tickets)
      .leftJoin(user, eq(tickets.taken_by, user.id))
      .where(where)
      .orderBy(desc(tickets.created_at));

    const legRows = await db
      .select()
      .from(ticketLegs)
      .where(
        inArray(
          ticketLegs.ticket_id,
          rows.map((r) => r.ticket.id)
        )
      )
      .orderBy(asc(ticketLegs.ticket_id), asc(ticketLegs.leg_number));
    const legsByTicket = groupBy(legRows, (leg) => leg.ticket_id);

    const reqsByTicket = await loadRequirementsForTickets(rows.map((r) => r.ticket.id));

    const ticketsResult: RelayPoolResponse['tickets'] = [];
    const unavailable: RelayPoolResponse['unavailable'] = [];
    for (const row of rows) {
      const legs = legsByTicket.get(row.ticket.id) ?? [];
      const claimable = pickClaimableLeg(legs);
      if (!claimable) continue;

      const reqs = reqsByTicket.get(row.ticket.id) ?? [];
      const ticket = await toTicket(row.ticket, reqs, null, row.takenByName ?? null);
      const reasons = unmetRequirementReasons(reqs, profile);
      const item: RelayPoolItem = {
        ...ticket,
        claimableLeg: {
          legId: claimable.id,
          legNumber: claimable.leg_number,
          name: claimable.name,
          legsTotal: legs.length
        }
      };
      if (reasons.length === 0) {
        ticketsResult.push(item);
      } else {
        unavailable.push({ ...item, eligibilityReasons: reasons });
      }
    }
    return { success: true, tickets: ticketsResult, unavailable };
  } catch (e) {
    mapDbError(e, 'tickets.listRelayPool');
  }
}

export async function listTickets(
  _userId: string,
  filters: TicketListFilters = {}
): Promise<TicketListResponse> {
  try {
    const where = buildConditions([
      filters.status ? eq(tickets.status, filters.status) : undefined,
      filters.domain != null
        ? filters.domain === 'field'
          ? inArray(tickets.task_type, [...FIELD_TASK_TYPES])
          : notInArray(tickets.task_type, [...FIELD_TASK_TYPES])
        : undefined,
      filters.priority != null ? eq(tickets.priority, filters.priority) : undefined
    ]);

    const directRows = await db
      .select()
      .from(tickets)
      .where(where)
      .orderBy(desc(tickets.created_at));

    const result: Ticket[] = [];
    for (const row of directRows) {
      const reqs = await loadRequirements(row.id);
      // load takenByName if present
      let takenByName: string | null = null;
      if (row.taken_by) {
        const [taker] = await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, row.taken_by))
          .limit(1);
        takenByName = taker?.name ?? null;
      }
      let creatorName: string | null = null;
      if (row.created_by) {
        const [creator] = await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, row.created_by))
          .limit(1);
        creatorName = creator?.name ?? null;
      }
      result.push(await toTicket(row, reqs, creatorName, takenByName));
    }
    return { success: true, tickets: result, unavailable: [] };
  } catch (e) {
    mapDbError(e, 'tickets.listTickets');
  }
}

export async function getTicketDetail(
  userId: string,
  ticketId: number
): Promise<TicketDetailResponse> {
  try {
    const [row] = await db
      .select({ ticket: tickets, takenByName: user.name })
      .from(tickets)
      .leftJoin(user, eq(tickets.taken_by, user.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);
    if (!row) return { success: false, message: 'Ticket not found' };
    const reqs = await loadRequirements(ticketId);
    const ticket = await toTicket(row.ticket, reqs, null, row.takenByName ?? null);
    const rawLegs = await db
      .select()
      .from(ticketLegs)
      .where(eq(ticketLegs.ticket_id, ticketId))
      .orderBy(asc(ticketLegs.leg_number));
    const legs = rawLegs.map(toLeg);

    // Viewer-scoped relay context: the detail page must show "Take Leg" instead
    // of "Start Leg" when the current user is NOT the ticket holder and a
    // claimable pool leg exists. Mirrors listRelayPool eligibility so the UI
    // never offers an action the server will reject.
    const isHolder = row.ticket.taken_by === userId || row.ticket.assigned_to === userId;
    let claimableLeg: RelayPoolLeg | null = null;
    let claimEligibilityReasons: string[] = [];
    if (!isHolder && row.ticket.status === 'in_progress') {
      const claimable = pickClaimableLeg(rawLegs);
      if (claimable) {
        claimableLeg = {
          legId: claimable.id,
          legNumber: claimable.leg_number,
          name: claimable.name,
          legsTotal: rawLegs.length
        };
        const profile = await getEligibilityProfile(userId);
        claimEligibilityReasons = unmetRequirementReasons(reqs, profile);
      }
    }

    const detail: TicketDetail = {
      ...ticket,
      legs,
      materials: await loadMaterials(ticketId),
      photos: await loadPhotos(ticketId),
      worklog: await loadWorklog(ticketId),
      requesterId: row.ticket.requester_id,
      createdAt: row.ticket.created_at.toISOString(),
      isHolder,
      claimableLeg,
      claimEligibilityReasons
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
      const reasons = unmetRequirementReasons(reqs, profile);
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

      const capMessage = await enforceActiveCap(tx, userId);
      if (capMessage) return { success: false, message: capMessage };

      const [claimed] = await tx
        .update(tickets)
        .set({
          status: 'assigned',
          taken_by: userId,
          taken_at: new Date(),
          first_taken_at: new Date(),
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

// Relay pool claim: transfers ticket ownership to the claimant for the next
// sequential leg. Template mirrors takeTicket (eligibility, active cap, race-safe
// conditional UPDATEs). The ticket stays in_progress — only taken_by moves.
export async function claimLeg(userId: string, legId: number): Promise<TicketActionResponse> {
  try {
    const result = await db.transaction(async (tx) => {
      const [leg] = await tx.select().from(ticketLegs).where(eq(ticketLegs.id, legId)).limit(1);
      if (!leg) return { success: false, message: 'Leg not found' };

      const [ticket] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, leg.ticket_id))
        .limit(1);
      if (!ticket) return { success: false, message: 'Ticket not found' };
      if (ticket.status !== 'in_progress') {
        return { success: false, message: 'Ticket is not in progress' };
      }

      // Only the nearest sequential pool leg is claimable (status assigned,
      // assignee null, every earlier leg submitted).
      const legs = await tx
        .select()
        .from(ticketLegs)
        .where(eq(ticketLegs.ticket_id, ticket.id))
        .orderBy(asc(ticketLegs.leg_number));
      const claimable = pickClaimableLeg(legs);
      if (!claimable || claimable.id !== legId) {
        return { success: false, message: 'Leg is not available in the relay pool' };
      }

      const profile = await getEligibilityProfile(userId);
      const reqs = await loadRequirements(ticket.id);
      const reasons = unmetRequirementReasons(reqs, profile);
      if (reasons.length > 0) {
        return { success: false, message: `Not eligible: ${reasons.join(', ')}` };
      }

      // Serialize concurrent claims by the same user on the user's own employees
      // row so the capacity re-count sees the just-claimed ticket (same reasoning
      // as takeTicket).
      await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, userId))
        .for('update')
        .limit(1);

      // Admin override: bypass active-ticket cap. A holder re-claiming their own
      // next leg (relay ganda) also skips the cap — they already hold the ticket.
      const isCurrentHolder = ticket.taken_by === userId;
      const capMessage = await enforceActiveCap(tx, userId, {
        skipForCurrentHolder: isCurrentHolder
      });
      if (capMessage) return { success: false, message: capMessage };

      // Claim the leg first (contended resource): conditional UPDATE returns a row
      // only when the leg is still unclaimed, so concurrent claimants race here.
      const [claimedLeg] = await tx
        .update(ticketLegs)
        .set({
          assignee_id: userId,
          taken_at: new Date(),
          updated_at: new Date()
        })
        .where(
          and(
            eq(ticketLegs.id, legId),
            eq(ticketLegs.status, 'assigned'),
            isNull(ticketLegs.assignee_id)
          )
        )
        .returning();
      if (!claimedLeg) return { success: false, message: 'Leg is no longer available' };

      // Transfer ownership. Roll back the whole tx if the ticket moved states
      // concurrently (e.g. last leg submitted by the holder).
      const [claimedTicket] = await tx
        .update(tickets)
        .set({ taken_by: userId, taken_at: new Date(), updated_at: new Date() })
        .where(and(eq(tickets.id, ticket.id), eq(tickets.status, 'in_progress')))
        .returning();
      if (!claimedTicket) throw new TicketClaimLostError();

      // Record the handoff so ownership history survives taken_by churn (the
      // spec defers history to worklog/audit, not taken_by).
      await tx.insert(ticketWorklog).values({
        leg_id: claimedLeg.id,
        kind: 'note',
        body: `Leg ${claimedLeg.leg_number} claimed (${claimedLeg.name})`,
        created_by: userId
      });

      return {
        success: true,
        message: 'Leg claimed',
        ticket: await toTicket(claimedTicket, reqs)
      };
    });
    return result;
  } catch (e) {
    if (e instanceof TicketClaimLostError) {
      return { success: false, message: 'Ticket is no longer in progress' };
    }
    mapDbError(e, 'tickets.claimLeg');
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

    // Guard: only one leg may be in_progress at a time — prevents 2× in_progress (0/3 stuck)
    const [blocking] = await db
      .select({ id: ticketLegs.id })
      .from(ticketLegs)
      .where(and(eq(ticketLegs.ticket_id, leg.ticket_id), eq(ticketLegs.status, 'in_progress')))
      .limit(1);
    if (blocking) {
      return { success: false, message: 'Another leg is already in progress — finish it first' };
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

export async function arriveTicket(
  userId: string,
  ticketId: number,
  location?: { latitude: number; longitude: number; accuracy: number }
): Promise<TicketActionResponse> {
  try {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), isMine(userId)))
      .limit(1);
    if (!ticket) return { success: false, message: 'You can only arrive at tickets you took' };
    if (ticket.status !== 'assigned') {
      return { success: false, message: 'Ticket can only be arrived from assigned' };
    }

    const legs = await db
      .select()
      .from(ticketLegs)
      .where(eq(ticketLegs.ticket_id, ticketId))
      .orderBy(asc(ticketLegs.leg_number))
      .limit(1);
    const leg = legs[0];
    if (!leg) return { success: false, message: 'Ticket has no legs' };

    const [updated] = await db
      .update(tickets)
      .set({ status: 'in_progress', updated_at: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.status, 'assigned')))
      .returning();
    if (!updated) return { success: false, message: 'Ticket is no longer available' };

    const body = formatArrivalBody(location);
    await db.insert(ticketWorklog).values({
      leg_id: leg.id,
      kind: 'location',
      body,
      created_by: userId
    });

    return {
      success: true,
      message: 'Arrived',
      ticket: await toTicket(updated, await loadRequirements(ticketId))
    };
  } catch (e) {
    mapDbError(e, 'tickets.arriveTicket');
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
    // 1 foto per ticket guard — server-side, cannot be bypassed via API.
    const existingPhotos = await loadPhotos(ticketId);
    if (existingPhotos.length < 1) {
      return { success: false, message: 'Work session requires at least 1 photo per ticket' };
    }

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
        .orderBy(asc(ticketLegs.leg_number));
      const leg = pickSubmittableLeg(legs);
      if (!leg) {
        return { success: false, message: 'Leg is no longer submittable' };
      }

      // 1 foto per ticket guard: first submit needs ≥1 new photo, later legs may reuse existing ticket photo.
      if (input.photos.length === 0) {
        const existingPhotos = await tx
          .select({ id: ticketPhotos.id })
          .from(ticketPhotos)
          .innerJoin(ticketLegs, eq(ticketPhotos.leg_id, ticketLegs.id))
          .where(eq(ticketLegs.ticket_id, ticketId));
        if (existingPhotos.length === 0) {
          return {
            success: false,
            message: 'Work session requires at least 1 photo per ticket'
          };
        }
      }

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
          notes: resolveSubmittedNotes(leg.notes, input.notes),
          updated_at: new Date()
        })
        .where(eq(ticketLegs.id, leg.id));

      const outcome = resolveLegAdvance(leg.leg_number, legs);

      if (outcome.kind === 'advance') {
        await tx
          .update(ticketLegs)
          .set({ status: 'assigned', updated_at: new Date() })
          .where(eq(ticketLegs.id, outcome.nextLeg.id));
      } else {
        // Last leg: the ticket now awaits SPV review (reviewTicket advances it
        // to completed on approval, rejected otherwise).
        await tx
          .update(tickets)
          .set({
            status: 'submitted',
            submitted_at: new Date(),
            updated_at: new Date()
          })
          .where(eq(tickets.id, ticketId));
      }

      return {
        success: true,
        message: 'Work session submitted',
        nextLeg:
          outcome.kind === 'advance'
            ? { legNumber: outcome.nextLeg.legNumber, name: outcome.nextLeg.name }
            : null,
        isLastLeg: outcome.kind === 'complete'
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
        notes: formatHandoffNote(leg.notes, note),
        updated_at: new Date()
      })
      .where(eq(ticketLegs.id, leg.id));

    return { success: true, message: 'Handoff note added' };
  } catch (e) {
    mapDbError(e, 'tickets.addHandoffNote');
  }
}

export async function reviewTicket(
  reviewerId: string,
  ticketId: number,
  decision: 'approved' | 'rejected',
  notes?: string
): Promise<TicketActionResponse> {
  try {
    const result = await db.transaction(async (tx) => {
      // One-way guard: only a submitted ticket may transition to approved or
      // rejected; the conditional UPDATE makes concurrent reviews race-safe.
      const [updated] = await tx
        .update(tickets)
        .set(
          decision === 'approved'
            ? {
                status: 'completed',
                reviewed_by: reviewerId,
                review_note: notes ?? '',
                completed_at: new Date(),
                updated_at: new Date()
              }
            : {
                status: 'rejected',
                reviewed_by: reviewerId,
                review_note: notes ?? '',
                updated_at: new Date()
              }
        )
        .where(and(eq(tickets.id, ticketId), eq(tickets.status, 'submitted')))
        .returning();
      if (!updated) return { success: false, message: 'Ticket is no longer awaiting review' };

      return {
        success: true,
        message: decision === 'approved' ? 'Ticket approved' : 'Ticket rejected',
        ticket: await toTicket(updated, await loadRequirements(ticketId))
      };
    });
    return result;
  } catch (e) {
    mapDbError(e, 'tickets.reviewTicket');
  }
}

export async function listSubmittedTickets(): Promise<TicketListResponse> {
  try {
    const rows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.status, 'submitted'))
      .orderBy(desc(tickets.submitted_at), desc(tickets.id));

    const result: Ticket[] = [];
    for (const row of rows) {
      result.push(await toTicket(row, await loadRequirements(row.id)));
    }
    return { success: true, tickets: result, unavailable: [] };
  } catch (e) {
    mapDbError(e, 'tickets.listSubmittedTickets');
  }
}

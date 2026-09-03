import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import {
  listOpenTickets,
  getTicketDetail,
  createTicket,
  takeTicket,
  startLeg,
  getMyTickets,
  getCompletedTickets,
  completeTicket,
  submitWorkSession,
  addHandoffNote,
  reviewTicket,
  listSubmittedTickets,
  claimLeg,
  listRelayPool,
  MAX_ACTIVE_TICKETS
} from './tickets';
import { db } from '@/lib/db';
import {
  tickets,
  ticketLegs,
  ticketMaterials,
  ticketPhotos,
  ticketWorklog
} from './schema/tickets';
import { roleGroups } from './schema/role-groups';
import { userRoleGroups } from './schema/user-role-groups';
import {
  resetAllTables,
  seedUser,
  seedEmployee,
  seedCustomer,
  seedLocation,
  seedTicket,
  seedTicketLeg,
  seedTicketMaterial,
  seedTicketRequirement,
  seedEmployeeSkill
} from '@/test-utils/db';

const USER_A = 'ticket-user-a';
const USER_B = 'ticket-user-b';
const USER_C = 'ticket-user-c';

describe('tickets data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('listOpenTickets', () => {
    it('returns empty when there are no open tickets', async () => {
      const res = await listOpenTickets(USER_A);
      expect(res.success).toBe(true);
      expect(res.tickets).toHaveLength(0);
      expect(res.unavailable).toHaveLength(0);
    });

    it('returns only open tickets', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      await seedTicket({ title: 'Open one' });
      await seedTicket({ title: 'Assigned one', status: 'assigned', taken_by: USER_B });
      await seedTicket({ title: 'Completed one', status: 'completed' });
      const res = await listOpenTickets(USER_A);
      expect(res.tickets.map((t) => t.title)).toEqual(['Open one']);
    });

    it('filters by domain: field includes installation/maintenance/inspection', async () => {
      await seedEmployee(USER_A);
      await seedTicket({ title: 'Install', task_type: 'installation' });
      await seedTicket({ title: 'Data entry', task_type: 'data' });
      await seedTicket({ title: 'Sales visit', task_type: 'sales' });
      const res = await listOpenTickets(USER_A, { domain: 'field' });
      expect(res.tickets.map((t) => t.title)).toEqual(['Install']);
    });

    it('filters by domain: backoffice includes data/sales', async () => {
      await seedEmployee(USER_A);
      await seedTicket({ title: 'Install', task_type: 'installation' });
      await seedTicket({ title: 'Data entry', task_type: 'data' });
      await seedTicket({ title: 'Sales visit', task_type: 'sales' });
      const res = await listOpenTickets(USER_A, { domain: 'backoffice' });
      expect(res.tickets.map((t) => t.title).sort()).toEqual(['Data entry', 'Sales visit']);
    });

    it('filters by priority', async () => {
      await seedEmployee(USER_A);
      await seedTicket({ title: 'High one', priority: 'high' });
      await seedTicket({ title: 'Low one', priority: 'low' });
      const res = await listOpenTickets(USER_A, { priority: 'high' });
      expect(res.tickets.map((t) => t.title)).toEqual(['High one']);
    });

    it('marks tickets with unmet requirements as unavailable with reasons', async () => {
      const { employee } = await seedEmployee(USER_A);
      const ticket = await seedTicket({ title: 'Skilled job' });
      await seedTicketRequirement(ticket.id, {
        department_id: employee.department_id,
        designation_id: employee.designation_id,
        skill: 'Fiber Optic'
      });
      const res = await listOpenTickets(USER_A);
      expect(res.tickets).toHaveLength(0);
      expect(res.unavailable).toHaveLength(1);
      expect(res.unavailable[0].title).toBe('Skilled job');
      expect(res.unavailable[0].eligibilityReasons).toContain('Requires skill: Fiber Optic');
    });

    it('includes customer and location on eligible tickets', async () => {
      await seedEmployee(USER_A);
      const customer = await seedCustomer({ full_name: 'PT Maju Jaya' });
      const location = await seedLocation({ name: 'Kedungwaringin' });
      await seedTicket({
        title: 'With customer',
        customer_id: customer.id,
        location_id: location.id
      });
      const res = await listOpenTickets(USER_A);
      expect(res.tickets[0].customer).toEqual(
        expect.objectContaining({ id: customer.id, name: 'PT Maju Jaya' })
      );
      expect(res.tickets[0].location).toEqual({ id: location.id, name: 'Kedungwaringin' });
    });
  });

  describe('getTicketDetail', () => {
    it('returns a ticket with legs, customer, and requirements', async () => {
      await seedUser(USER_A);
      const customer = await seedCustomer({ full_name: 'CV Berkah' });
      const ticket = await seedTicket({
        title: 'Estafet job',
        customer_id: customer.id,
        created_by: 'seed'
      });
      const leg1 = await seedTicketLeg(ticket.id, { name: 'Survey' });
      const leg2 = await seedTicketLeg(ticket.id, { name: 'Install' });
      await seedTicketRequirement(ticket.id, { skill: 'Fiber Optic' });

      const res = await getTicketDetail(USER_A, ticket.id);
      expect(res.success).toBe(true);
      expect(res.ticket?.title).toBe('Estafet job');
      expect(res.ticket?.customer).toEqual(
        expect.objectContaining({ id: customer.id, name: 'CV Berkah' })
      );
      expect(res.ticket?.requiredSkills).toContain('Fiber Optic');
      expect(res.ticket?.legs.map((l) => l.name)).toEqual(['Survey', 'Install']);
      expect(res.ticket?.legs.map((l) => l.legNumber)).toEqual([1, 2]);
      expect(res.ticket?.legs[0].status).toBe('open');
      expect(leg1.id).not.toBe(leg2.id);
    });

    it('exposes review note and reviewer on rejected/rework tickets', async () => {
      await seedUser(USER_A);
      await seedUser('reviewer-1');
      const ticket = await seedTicket({
        title: 'Reworked install',
        status: 'rework',
        review_note: 'Missing photo evidence',
        reviewed_by: 'reviewer-1'
      });
      await seedTicketLeg(ticket.id, { status: 'rework' });
      const res = await getTicketDetail(USER_A, ticket.id);
      expect(res.success).toBe(true);
      expect(res.ticket?.reviewNote).toBe('Missing photo evidence');
      expect(res.ticket?.reviewedBy).toBe('reviewer-1');
    });

    it('returns a failure message when the ticket does not exist', async () => {
      const res = await getTicketDetail(USER_A, 999_999);
      expect(res.success).toBe(false);
      expect(res.message).toBeDefined();
    });

    it('maps the rating from the tickets table', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket({ title: 'Rated job', status: 'completed', rating: 5 });
      const res = await getTicketDetail(USER_A, ticket.id);
      expect(res.success).toBe(true);
      expect(res.ticket?.rating).toBe(5);
    });

    it('returns materials per leg with leg names', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket({ title: 'Materials job', status: 'completed' });
      const leg = await seedTicketLeg(ticket.id, { status: 'completed', name: 'Install' });
      await seedTicketMaterial(leg.id, { material_name: 'Fiber Router', qty: 2, unit: 'unit' });
      await seedTicketMaterial(leg.id, {
        material_name: 'Patch cable',
        qty: 4,
        source: 'warehouse'
      });
      const res = await getTicketDetail(USER_A, ticket.id);
      expect(res.success).toBe(true);
      expect(res.ticket?.materials).toEqual([
        {
          id: expect.any(Number),
          legId: leg.id,
          legName: 'Install',
          materialName: 'Fiber Router',
          qty: 2,
          unit: 'unit',
          source: 'van',
          barcode: ''
        },
        {
          id: expect.any(Number),
          legId: leg.id,
          legName: 'Install',
          materialName: 'Patch cable',
          qty: 4,
          unit: '',
          source: 'warehouse',
          barcode: ''
        }
      ]);
    });
  });

  describe('createTicket', () => {
    it('creates a ticket with generated code, open status, and default channel', async () => {
      await seedUser(USER_A, { role: 'admin' });
      const res = await createTicket(USER_A, { title: 'Install router' });
      expect(res.success).toBe(true);
      expect(res.ticket?.ticketCode).toBe(`T-${res.ticket?.id}`);
      expect(res.ticket?.status).toBe('open');
      expect(res.ticket?.channel).toBe('field');
      expect(res.ticket?.domain).toBe('field');
      expect(res.ticket?.legs).toHaveLength(1);
      expect(res.ticket?.legs[0].legNumber).toBe(1);
    });

    it('creates legs with sequential leg numbers', async () => {
      await seedUser(USER_A, { role: 'admin' });
      const res = await createTicket(USER_A, {
        title: 'Estafet install',
        legs: [
          { name: 'Survey', description: 'Check site' },
          { name: 'Install', description: 'Run fiber' }
        ]
      });
      expect(res.ticket?.legs.map((l) => l.legNumber)).toEqual([1, 2]);
      expect(res.ticket?.legs.map((l) => l.name)).toEqual(['Survey', 'Install']);
      expect(res.ticket?.legs[1].description).toBe('Run fiber');
    });

    it('stores customer, asset name, and task type', async () => {
      await seedUser(USER_A, { role: 'admin' });
      const customer = await seedCustomer({ full_name: 'PT Nusantara' });
      const res = await createTicket(USER_A, {
        title: 'Data update',
        customerId: customer.id,
        assetName: 'OLT-42',
        taskType: 'data',
        priority: 'high'
      });
      expect(res.ticket?.customer).toEqual(
        expect.objectContaining({ id: customer.id, name: 'PT Nusantara' })
      );
      expect(res.ticket?.assetName).toBe('OLT-42');
      expect(res.ticket?.taskType).toBe('data');
      expect(res.ticket?.domain).toBe('backoffice');
      expect(res.ticket?.priority).toBe('high');
    });
  });

  describe('takeTicket', () => {
    it('assigns an open ticket to the user', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({ title: 'Grab me' });
      const res = await takeTicket(USER_A, ticket.id);
      expect(res.success).toBe(true);
      expect(res.ticket?.status).toBe('assigned');
      expect(res.ticket?.takenBy).toBe(USER_A);

      const [row] = await db
        .select({ status: tickets.status, taken_at: tickets.taken_at })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(row?.status).toBe('assigned');
      expect(row?.taken_at).toBeTruthy();
    });

    it('rejects a ticket already taken by another user', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket({
        title: 'Taken',
        status: 'assigned',
        taken_by: USER_B
      });
      const res = await takeTicket(USER_A, ticket.id);
      expect(res.success).toBe(false);
    });

    it('enforces the active ticket limit', async () => {
      await seedEmployee(USER_A);
      for (let i = 0; i < MAX_ACTIVE_TICKETS; i++) {
        await seedTicket({
          title: `Active ${i}`,
          status: 'assigned',
          taken_by: USER_A
        });
      }
      const open = await seedTicket({ title: 'One too many' });
      const res = await takeTicket(USER_A, open.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain(String(MAX_ACTIVE_TICKETS));
    });

    it('rejects when eligibility is not met', async () => {
      const { employee } = await seedEmployee(USER_A);
      const ticket = await seedTicket({ title: 'Skill gate' });
      await seedTicketRequirement(ticket.id, {
        department_id: employee.department_id,
        designation_id: employee.designation_id,
        skill: 'Fiber Optic'
      });
      const res = await takeTicket(USER_A, ticket.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Fiber Optic');
    });

    it('allows take when requirements are met', async () => {
      const { employee } = await seedEmployee(USER_A);
      await seedEmployeeSkill(USER_A, 'Fiber Optic');
      const ticket = await seedTicket({ title: 'Qualified' });
      await seedTicketRequirement(ticket.id, {
        department_id: employee.department_id,
        designation_id: employee.designation_id,
        skill: 'Fiber Optic'
      });
      const res = await takeTicket(USER_A, ticket.id);
      expect(res.success).toBe(true);
    });
  });

  describe('startLeg', () => {
    it('starts an open leg of a ticket taken by the user', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'My estafet',
        status: 'assigned',
        taken_by: USER_A,
        created_by: 'seed'
      });
      const leg = await seedTicketLeg(ticket.id, { name: 'Survey' });

      const res = await startLeg(USER_A, leg.id);
      expect(res.success).toBe(true);

      const [row] = await db
        .select({
          status: ticketLegs.status,
          assignee_id: ticketLegs.assignee_id,
          taken_at: ticketLegs.taken_at
        })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg.id));
      expect(row?.status).toBe('in_progress');
      expect(row?.assignee_id).toBe(USER_A);
      expect(row?.taken_at).toBeTruthy();
    });

    it('rejects a leg from a ticket the user did not take', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket({
        title: 'Not mine',
        status: 'assigned',
        taken_by: USER_B,
        created_by: 'seed'
      });
      const leg = await seedTicketLeg(ticket.id, { name: 'Survey' });
      const res = await startLeg(USER_A, leg.id);
      expect(res.success).toBe(false);
    });

    it('rejects starting a leg that is already in progress', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Started',
        status: 'assigned',
        taken_by: USER_A,
        created_by: 'seed'
      });
      const leg = await seedTicketLeg(ticket.id, { name: 'Survey', status: 'in_progress' });
      const res = await startLeg(USER_A, leg.id);
      expect(res.success).toBe(false);
    });
  });

  describe('getMyTickets', () => {
    it('returns empty when the user has no tickets', async () => {
      const res = await getMyTickets(USER_A);
      expect(res.success).toBe(true);
      expect(res.tickets).toHaveLength(0);
    });

    it('returns assigned and in-progress tickets for the user only', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      await seedTicket({ title: 'Mine assigned', assigned_to: USER_A, status: 'assigned' });
      await seedTicket({ title: 'Mine in progress', taken_by: USER_A, status: 'in_progress' });
      await seedTicket({ title: 'Theirs', taken_by: USER_B, status: 'in_progress' });
      await seedTicket({ title: 'Open not mine', status: 'open' });

      const res = await getMyTickets(USER_A);
      expect(res.tickets.map((t) => t.title).sort()).toEqual(['Mine assigned', 'Mine in progress']);
    });

    it('includes submitted tickets as pending approval', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket({
        title: 'Submitted job',
        status: 'submitted',
        taken_by: USER_A
      });
      const res = await getMyTickets(USER_A);
      expect(res.tickets.map((t) => t.id)).toContain(ticket.id);
    });
  });

  describe('getCompletedTickets', () => {
    it('returns only completed tickets the user took', async () => {
      await seedUser(USER_A);
      await seedUser('someone-else');
      const mine = await seedTicket({ title: 'Done by me', status: 'completed', taken_by: USER_A });
      await seedTicket({ title: 'Done by others', status: 'completed', taken_by: 'someone-else' });
      await seedTicket({ title: 'Still open', status: 'open' });
      const res = await getCompletedTickets(USER_A);
      expect(res.success).toBe(true);
      expect(res.tickets.map((t) => t.id)).toEqual([mine.id]);
    });

    it('returns an empty list when the user completed nothing', async () => {
      await seedUser(USER_A);
      const res = await getCompletedTickets(USER_A);
      expect(res.success).toBe(true);
      expect(res.tickets).toHaveLength(0);
    });
  });

  describe('completeTicket', () => {
    it('completes an in-progress ticket and finishes its legs (requires 1 photo per ticket)', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Finishing',
        status: 'in_progress',
        taken_by: USER_A,
        created_by: 'seed'
      });
      const leg1 = await seedTicketLeg(ticket.id, { name: 'Survey', status: 'in_progress' });
      await seedTicketLeg(ticket.id, { name: 'Install', status: 'open' });
      await db
        .insert(ticketPhotos)
        .values({ leg_id: leg1.id, file_url: 'test/photo.jpg', uploader_id: USER_A });

      const res = await completeTicket(USER_A, ticket.id);
      expect(res.success).toBe(true);
      expect(res.ticket?.status).toBe('completed');
      expect(res.ticket?.completedAt).toBeTruthy();

      const legs = await db
        .select({ status: ticketLegs.status })
        .from(ticketLegs)
        .where(eq(ticketLegs.ticket_id, ticket.id));
      expect(legs.every((l) => l.status === 'completed')).toBe(true);
    });

    it('rejects complete without any photo (1 foto per ticket guard)', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'No photo',
        status: 'in_progress',
        taken_by: USER_A,
        created_by: 'seed'
      });
      await seedTicketLeg(ticket.id, { name: 'Survey', status: 'in_progress' });
      const res = await completeTicket(USER_A, ticket.id);
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/photo/i);
    });

    it('rejects when the ticket is not in progress by the user', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket({
        title: 'Not mine',
        status: 'in_progress',
        taken_by: USER_B,
        created_by: 'seed'
      });
      const res = await completeTicket(USER_A, ticket.id);
      expect(res.success).toBe(false);
    });
  });

  describe('submitWorkSession', () => {
    it('completes an in-progress ticket taken by the user, persisting materials, photos and notes', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket({
        title: 'Field install',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      const leg = await seedTicketLeg(ticket.id, { status: 'in_progress' });

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [{ name: 'Drop cable', qty: 15, unit: 'm', source: 'van' }],
        photos: [{ fileUrl: 'tickets/0/1.jpg' }],
        notes: 'Spliced and tested',
        log: []
      });

      expect(res.success).toBe(true);

      const detail = await getTicketDetail(USER_A, ticket.id);
      expect(detail.success).toBe(true);
      expect(detail.ticket?.status).toBe('submitted');
      expect(detail.ticket?.materials).toHaveLength(1);
      expect(detail.ticket?.materials[0]).toMatchObject({
        materialName: 'Drop cable',
        qty: 15,
        unit: 'm',
        source: 'van'
      });
      expect(detail.ticket?.photos).toHaveLength(1);
      expect(detail.ticket?.photos[0].fileUrl).toBe('tickets/0/1.jpg');

      const [legRow] = await db
        .select({ status: ticketLegs.status, notes: ticketLegs.notes })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg.id));
      expect(legRow?.status).toBe('submitted');
      expect(legRow?.notes).toBe('Spliced and tested');
    });

    it('rejects when the ticket is not in_progress by the user', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket({
        title: 'Open one',
        status: 'open',
        taken_by: USER_B
      });
      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/1.jpg' }],
        notes: '',
        log: []
      });
      expect(res.success).toBe(false);
    });

    it('attaches everything to the first leg when no leg is in progress', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Multi-leg',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      const firstLeg = await seedTicketLeg(ticket.id, { status: 'open' });
      await seedTicketLeg(ticket.id, { status: 'open' });

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [{ name: 'ONT', qty: 1, unit: '', source: 'van' }],
        photos: [{ fileUrl: 'tickets/0/2.jpg' }],
        notes: '',
        log: []
      });
      expect(res.success).toBe(true);

      const [legRow] = await db
        .select({ id: ticketLegs.id, status: ticketLegs.status })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, firstLeg.id));
      expect(legRow?.status).toBe('submitted');
      const legs = await db
        .select({ status: ticketLegs.status })
        .from(ticketLegs)
        .where(eq(ticketLegs.ticket_id, ticket.id));
      expect(legs.map((l) => l.status)).toEqual(['submitted', 'assigned']);
      const detail = await getTicketDetail(USER_A, ticket.id);
      expect(detail.ticket?.status).toBe('in_progress');
    });

    it('prefers the in-progress leg when an earlier leg is still open', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Later leg in progress',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      await seedTicketLeg(ticket.id, { status: 'open' });
      const secondLeg = await seedTicketLeg(ticket.id, { status: 'in_progress' });
      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/3.jpg' }],
        notes: '',
        log: []
      });
      expect(res.success).toBe(true);

      const [secondRow] = await db
        .select({ status: ticketLegs.status })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, secondLeg.id));
      expect(secondRow?.status).toBe('submitted');
      const [ticketRow] = await db
        .select({ status: tickets.status })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(ticketRow?.status).toBe('submitted');
    });

    it('preserves pre-existing leg notes when the submitted notes are empty', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Keep notes',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      const leg = await seedTicketLeg(ticket.id, { status: 'in_progress', notes: 'Original' });

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/4.jpg' }],
        notes: '',
        log: []
      });
      expect(res.success).toBe(true);

      const [legRow] = await db
        .select({ notes: ticketLegs.notes })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg.id));
      expect(legRow?.notes).toBe('Original');
    });

    it('does not erase a saved handoff note when re-submitting the last leg', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Handoff note',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      const leg = await seedTicketLeg(ticket.id, {
        status: 'in_progress',
        notes: 'Handoff: Send courier'
      });

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/5.jpg' }],
        notes: '',
        log: []
      });
      expect(res.success).toBe(true);

      const [legRow] = await db
        .select({ notes: ticketLegs.notes })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg.id));
      expect(legRow?.notes).toBe('Handoff: Send courier');

      const [ticketRow] = await db
        .select({ status: tickets.status })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(ticketRow?.status).toBe('submitted');
    });
  });

  describe('submitWorkSession leg advance + worklog', () => {
    it('advances to the pre-assigned next leg and keeps the ticket in progress', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket({
        title: 'Two leg',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      await seedTicketLeg(ticket.id, { name: 'Survey', status: 'in_progress' });
      await seedTicketLeg(ticket.id, { name: 'Install', status: 'open', assignee_id: USER_B });

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/9.jpg' }],
        notes: 'Survey done',
        log: [
          { kind: 'note', body: 'Found the OLT' },
          { kind: 'meter', body: '855 nm' }
        ]
      });
      expect(res.success).toBe(true);
      expect(res.isLastLeg).toBe(false);
      expect(res.nextLeg).toEqual({ legNumber: 2, name: 'Install' });

      const legs = await db
        .select({ leg_number: ticketLegs.leg_number, status: ticketLegs.status })
        .from(ticketLegs)
        .where(eq(ticketLegs.ticket_id, ticket.id))
        .orderBy(ticketLegs.leg_number);
      expect(legs).toEqual([
        { leg_number: 1, status: 'submitted' },
        { leg_number: 2, status: 'assigned' }
      ]);

      const detail = await getTicketDetail(USER_A, ticket.id);
      expect(detail.ticket?.status).toBe('in_progress');
      expect(detail.ticket?.worklog).toHaveLength(2);
      expect(detail.ticket?.worklog[0]).toMatchObject({ kind: 'note', body: 'Found the OLT' });
      expect(detail.ticket?.worklog[1]).toMatchObject({ kind: 'meter', body: '855 nm' });
    });

    it('advances to an open (unassigned) next leg — pool semantics', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Open next',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      await seedTicketLeg(ticket.id, { name: 'Leg 1', status: 'in_progress' });
      await seedTicketLeg(ticket.id, { name: 'Leg 2', status: 'open' });

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/8.jpg' }],
        notes: '',
        log: []
      });
      expect(res.success).toBe(true);
      expect(res.isLastLeg).toBe(false);
      expect(res.nextLeg).toEqual({ legNumber: 2, name: 'Leg 2' });

      const legs = await db
        .select({ status: ticketLegs.status })
        .from(ticketLegs)
        .where(eq(ticketLegs.ticket_id, ticket.id))
        .orderBy(ticketLegs.leg_number);
      expect(legs.map((l) => l.status)).toEqual(['submitted', 'assigned']);
    });

    it('submits the ticket for review on the last leg and reports isLastLeg', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Last leg',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      await seedTicketLeg(ticket.id, { name: 'Only', status: 'in_progress' });

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/7.jpg' }],
        notes: 'Done',
        log: [{ kind: 'note', body: 'All good' }]
      });
      expect(res.success).toBe(true);
      expect(res.isLastLeg).toBe(true);
      expect(res.nextLeg).toBeNull();

      const [row] = await db
        .select({ status: tickets.status, submitted_at: tickets.submitted_at })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(row?.status).toBe('submitted');
      expect(row?.submitted_at).toBeInstanceOf(Date);
    });

    it('blocks re-submission after a leg advance without inserting duplicates', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Double submit',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      const leg1 = await seedTicketLeg(ticket.id, { name: 'Leg 1', status: 'submitted' });
      const leg2 = await seedTicketLeg(ticket.id, { name: 'Leg 2', status: 'assigned' });

      const countRows = async () => {
        const [materials, photos, worklog] = await Promise.all([
          db
            .select()
            .from(ticketMaterials)
            .where(inArray(ticketMaterials.leg_id, [leg1.id, leg2.id])),
          db
            .select()
            .from(ticketPhotos)
            .where(inArray(ticketPhotos.leg_id, [leg1.id, leg2.id])),
          db
            .select()
            .from(ticketWorklog)
            .where(inArray(ticketWorklog.leg_id, [leg1.id, leg2.id]))
        ]);
        return [materials.length, photos.length, worklog.length] as const;
      };

      const before = await countRows();

      const res = await submitWorkSession(USER_A, ticket.id, {
        materials: [{ name: 'ONT', qty: 1, unit: '', source: 'van' }],
        photos: [{ fileUrl: 'tickets/0/6.jpg' }],
        notes: '',
        log: [{ kind: 'note', body: 'duplicate?' }]
      });
      expect(res.success).toBe(false);

      expect(await countRows()).toEqual(before);
    });
  });

  async function seedPoolTicket(takenBy = USER_A) {
    await seedEmployee(takenBy);
    const ticket = await seedTicket({
      title: 'Relay ticket',
      status: 'in_progress',
      taken_by: takenBy,
      taken_at: new Date('2026-08-10T08:00:00'),
      first_taken_at: new Date('2026-08-10T08:00:00')
    });
    const leg1 = await seedTicketLeg(ticket.id, { name: 'Survey', status: 'submitted' });
    const leg2 = await seedTicketLeg(ticket.id, { name: 'Install', status: 'assigned' });
    return { ticket, leg1, leg2 };
  }

  describe('claimLeg', () => {
    it('transfers ownership to the claimant for the next pool leg', async () => {
      const { ticket, leg2 } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);

      const res = await claimLeg(USER_B, leg2.id);
      expect(res.success).toBe(true);
      expect(res.ticket?.takenBy).toBe(USER_B);

      const [legRow] = await db
        .select({ assignee_id: ticketLegs.assignee_id, status: ticketLegs.status })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg2.id));
      expect(legRow?.assignee_id).toBe(USER_B);
      expect(legRow?.status).toBe('assigned');

      const [ticketRow] = await db
        .select({
          status: tickets.status,
          taken_by: tickets.taken_by,
          taken_at: tickets.taken_at,
          first_taken_at: tickets.first_taken_at
        })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(ticketRow?.status).toBe('in_progress');
      expect(ticketRow?.taken_by).toBe(USER_B);

      // taken_at resets to the claimant's session start, but first_taken_at
      // survives so the total ticket duration (for achievements) is preserved.
      expect(ticketRow?.first_taken_at?.getTime()).toBe(new Date('2026-08-10T08:00:00').getTime());

      // The handoff is recorded in the worklog so ownership history survives
      // taken_by churn.
      const [claimLog] = await db
        .select({ kind: ticketWorklog.kind, body: ticketWorklog.body })
        .from(ticketWorklog)
        .where(eq(ticketWorklog.leg_id, leg2.id));
      expect(claimLog?.kind).toBe('note');
      expect(claimLog?.body).toContain('Leg 2 claimed');

      // B can now work the claimed leg through the normal guards.
      const startRes = await startLeg(USER_B, leg2.id);
      expect(startRes.success).toBe(true);
      const submitRes = await submitWorkSession(USER_B, ticket.id, {
        materials: [],
        photos: [{ fileUrl: 'tickets/0/relay.jpg' }],
        notes: 'Install done',
        log: []
      });
      expect(submitRes.success).toBe(true);
      expect(submitRes.isLastLeg).toBe(true);
    });

    it('rejects a leg that is already claimed (assignee set)', async () => {
      const { leg2 } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);
      await db
        .update(ticketLegs)
        .set({ assignee_id: USER_A, taken_at: new Date() })
        .where(eq(ticketLegs.id, leg2.id));

      const res = await claimLeg(USER_B, leg2.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('not available');
    });

    it('rejects a non-sequential leg (later leg before the pool leg)', async () => {
      const { ticket } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);
      const leg3 = await seedTicketLeg(ticket.id, { name: 'Leg 3', status: 'assigned' });

      const res = await claimLeg(USER_B, leg3.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('not available');
    });

    it('rejects a claim on a ticket that is not in progress', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const ticket = await seedTicket({
        title: 'Submitted ticket',
        status: 'submitted',
        taken_by: USER_A
      });
      const leg2 = await seedTicketLeg(ticket.id, { name: 'Install', status: 'assigned' });

      const res = await claimLeg(USER_B, leg2.id);
      expect(res.success).toBe(false);
      expect(res.message).toBe('Ticket is not in progress');
    });

    it('rejects when the claimant is not eligible', async () => {
      const { ticket, leg2 } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);
      await seedTicketRequirement(ticket.id, { skill: 'Fiber Optic' });

      const res = await claimLeg(USER_B, leg2.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Not eligible');
    });

    it('rejects when the claimant is at the active ticket cap', async () => {
      const { leg2 } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);
      for (let i = 0; i < MAX_ACTIVE_TICKETS; i++) {
        const other = await seedTicket({
          title: `B ticket ${i}`,
          status: 'in_progress',
          taken_by: USER_B
        });
        await seedTicketLeg(other.id, { name: 'Leg 1', status: 'in_progress' });
      }

      const res = await claimLeg(USER_B, leg2.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Active ticket limit reached');
    });

    it('lets an admin bypass the active ticket cap', async () => {
      const { leg2 } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);
      await db.insert(roleGroups).values({
        id: 'admin-group',
        name: 'Admins',
        is_admin: true
      });
      await db.insert(userRoleGroups).values({
        user_id: USER_B,
        role_group_id: 'admin-group'
      });
      for (let i = 0; i < MAX_ACTIVE_TICKETS; i++) {
        const other = await seedTicket({
          title: `B ticket ${i}`,
          status: 'in_progress',
          taken_by: USER_B
        });
        await seedTicketLeg(other.id, { name: 'Leg 1', status: 'in_progress' });
      }

      const res = await claimLeg(USER_B, leg2.id);
      expect(res.success).toBe(true);
    });

    it('allows the current holder to re-claim their own next leg (relay ganda)', async () => {
      const { ticket, leg2 } = await seedPoolTicket(USER_A);

      const res = await claimLeg(USER_A, leg2.id);
      expect(res.success).toBe(true);
      const [ticketRow] = await db
        .select({ taken_by: tickets.taken_by })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(ticketRow?.taken_by).toBe(USER_A);
    });

    it('lets exactly one of two concurrent claimants win', async () => {
      const { leg2 } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);
      await seedEmployee(USER_C);

      const [resB, resC] = await Promise.all([
        claimLeg(USER_B, leg2.id),
        claimLeg(USER_C, leg2.id)
      ]);
      const wins = [resB, resC].filter((r) => r.success);
      expect(wins).toHaveLength(1);

      const [legRow] = await db
        .select({ assignee_id: ticketLegs.assignee_id })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg2.id));
      expect([USER_B, USER_C]).toContain(legRow?.assignee_id);
    });
  });

  describe('listRelayPool', () => {
    it('lists in_progress tickets with an unclaimed next leg and holder info', async () => {
      const { leg2 } = await seedPoolTicket(USER_A);
      await seedEmployee(USER_B);

      const res = await listRelayPool(USER_B);
      expect(res.success).toBe(true);
      expect(res.tickets).toHaveLength(1);
      const item = res.tickets[0];
      expect(item.title).toBe('Relay ticket');
      expect(item.takenByName).toBe('Test User');
      expect(item.claimableLeg).toEqual({
        legId: leg2.id,
        legNumber: 2,
        name: 'Install',
        legsTotal: 2
      });
    });

    it('excludes tickets without an unclaimed pool leg', async () => {
      await seedEmployee(USER_A);
      const done = await seedTicket({
        title: 'All done',
        status: 'in_progress',
        taken_by: USER_A
      });
      await seedTicketLeg(done.id, { name: 'Leg 1', status: 'submitted' });
      const claimed = await seedTicket({
        title: 'Already claimed',
        status: 'in_progress',
        taken_by: USER_A
      });
      await seedTicketLeg(claimed.id, { name: 'Leg 1', status: 'submitted' });
      await seedTicketLeg(claimed.id, { name: 'Leg 2', status: 'assigned', assignee_id: USER_A });

      const res = await listRelayPool(USER_B);
      expect(res.tickets).toHaveLength(0);
    });

    it('splits out tickets the viewer is not eligible for', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Skilled relay',
        status: 'in_progress',
        taken_by: USER_A
      });
      await seedTicketLeg(ticket.id, { name: 'Leg 1', status: 'submitted' });
      await seedTicketLeg(ticket.id, { name: 'Leg 2', status: 'assigned' });
      await seedTicketRequirement(ticket.id, { skill: 'Fiber Optic' });

      const res = await listRelayPool(USER_B);
      expect(res.tickets).toHaveLength(0);
      expect(res.unavailable).toHaveLength(1);
      expect(res.unavailable[0].eligibilityReasons).toContain('Requires skill: Fiber Optic');
    });
  });

  describe('addHandoffNote', () => {
    it('appends a Handoff prefix to the submitted leg of a ticket taken by the user', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Pickup',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      const leg = await seedTicketLeg(ticket.id, { name: 'Install', status: 'submitted' });

      const res = await addHandoffNote(USER_A, leg.id, 'Materials in van, send courier');
      expect(res.success).toBe(true);

      const [row] = await db
        .select({ notes: ticketLegs.notes })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg.id));
      expect(row?.notes).toBe('Handoff: Materials in van, send courier');
    });

    it('appends to existing notes with a newline separator', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Pickup 2',
        status: 'in_progress',
        taken_by: USER_A,
        taken_at: new Date()
      });
      const leg = await seedTicketLeg(ticket.id, {
        name: 'Install',
        notes: 'Spliced',
        status: 'submitted'
      });

      await addHandoffNote(USER_A, leg.id, 'Courier: Budi');
      const [row] = await db
        .select({ notes: ticketLegs.notes })
        .from(ticketLegs)
        .where(eq(ticketLegs.id, leg.id));
      expect(row?.notes).toBe('Spliced\nHandoff: Courier: Budi');
    });

    it('rejects a leg not owned by the user', async () => {
      await seedEmployee(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket({
        title: 'Not mine',
        status: 'in_progress',
        taken_by: USER_B,
        taken_at: new Date()
      });
      const leg = await seedTicketLeg(ticket.id, { name: 'Install', status: 'submitted' });
      const res = await addHandoffNote(USER_A, leg.id, 'Nope');
      expect(res.success).toBe(false);
    });
  });

  describe('reviewTicket', () => {
    it('approves a submitted ticket and records reviewer and note', async () => {
      await seedUser(USER_A);
      await seedUser('reviewer-1');
      const ticket = await seedTicket({ title: 'Awaiting review', status: 'submitted' });

      const res = await reviewTicket('reviewer-1', ticket.id, 'approved', 'Looks good');
      expect(res.success).toBe(true);
      expect(res.ticket?.status).toBe('completed');
      expect(res.ticket?.reviewedBy).toBe('reviewer-1');
      expect(res.ticket?.reviewNote).toBe('Looks good');

      const [row] = await db
        .select({
          status: tickets.status,
          reviewed_by: tickets.reviewed_by,
          review_note: tickets.review_note,
          completed_at: tickets.completed_at
        })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(row?.status).toBe('completed');
      expect(row?.reviewed_by).toBe('reviewer-1');
      expect(row?.review_note).toBe('Looks good');
      expect(row?.completed_at).toBeInstanceOf(Date);
    });

    it('rejects a submitted ticket with an empty note when none is given', async () => {
      await seedUser(USER_A);
      await seedUser('reviewer-1');
      const ticket = await seedTicket({ title: 'Awaiting review', status: 'submitted' });

      const res = await reviewTicket('reviewer-1', ticket.id, 'rejected');
      expect(res.success).toBe(true);
      expect(res.ticket?.status).toBe('rejected');
      expect(res.ticket?.reviewedBy).toBe('reviewer-1');

      const [row] = await db
        .select({ review_note: tickets.review_note })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(row?.review_note).toBe('');
    });

    it('is one-way: does not change an already-approved ticket', async () => {
      await seedUser(USER_A);
      await seedUser('reviewer-1');
      await seedUser('first-reviewer');
      const ticket = await seedTicket({
        title: 'Already approved',
        status: 'approved',
        reviewed_by: 'first-reviewer',
        review_note: 'First pass'
      });

      const res = await reviewTicket('reviewer-1', ticket.id, 'rejected', 'Trying again');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Ticket is no longer awaiting review');

      const [row] = await db
        .select({ status: tickets.status, reviewed_by: tickets.reviewed_by })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(row?.status).toBe('approved');
      expect(row?.reviewed_by).toBe('first-reviewer');
    });

    it('is one-way: does not change a non-submitted (in_progress) ticket', async () => {
      await seedUser(USER_A);
      await seedUser('reviewer-1');
      const ticket = await seedTicket({ title: 'Still in progress', status: 'in_progress' });

      const res = await reviewTicket('reviewer-1', ticket.id, 'approved');
      expect(res.success).toBe(false);

      const [row] = await db
        .select({ status: tickets.status })
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(row?.status).toBe('in_progress');
    });

    it('returns failure for a nonexistent ticket', async () => {
      await seedUser(USER_A);
      const res = await reviewTicket('reviewer-1', 999_999, 'approved');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Ticket is no longer awaiting review');
    });
  });

  describe('listSubmittedTickets', () => {
    it('returns only submitted tickets, newest submission first', async () => {
      await seedUser(USER_A);
      const openTicket = await seedTicket({ title: 'Still open', status: 'open' });
      const old = await seedTicket({
        title: 'Older submission',
        status: 'submitted',
        submitted_at: new Date('2026-08-01T10:00:00Z')
      });
      const newer = await seedTicket({
        title: 'Newer submission',
        status: 'submitted',
        submitted_at: new Date('2026-08-02T10:00:00Z')
      });

      const res = await listSubmittedTickets();
      expect(res.success).toBe(true);
      const ids = res.tickets.map((t) => t.id);
      expect(ids).toContain(old.id);
      expect(ids).toContain(newer.id);
      expect(ids).not.toContain(openTicket.id);
      // Newest submitted_at first
      expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(old.id));
    });

    it('returns an empty list when nothing is submitted', async () => {
      const res = await listSubmittedTickets();
      expect(res.success).toBe(true);
      expect(res.tickets).toHaveLength(0);
    });
  });
});

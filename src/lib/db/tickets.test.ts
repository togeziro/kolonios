import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  listOpenTickets,
  getTicketDetail,
  createTicket,
  takeTicket,
  startLeg,
  getMyTickets,
  completeTicket,
  MAX_ACTIVE_TICKETS
} from './tickets';
import { db } from '@/lib/db';
import { tickets, ticketLegs } from './schema/tickets';
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
      expect(res.tickets[0].customer).toEqual({ id: customer.id, name: 'PT Maju Jaya' });
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
      expect(res.ticket?.customer).toEqual({ id: customer.id, name: 'CV Berkah' });
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
      expect(res.ticket?.customer).toEqual({ id: customer.id, name: 'PT Nusantara' });
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
  });

  describe('completeTicket', () => {
    it('completes an in-progress ticket and finishes its legs', async () => {
      await seedEmployee(USER_A);
      const ticket = await seedTicket({
        title: 'Finishing',
        status: 'in_progress',
        taken_by: USER_A,
        created_by: 'seed'
      });
      await seedTicketLeg(ticket.id, { name: 'Survey', status: 'in_progress' });
      await seedTicketLeg(ticket.id, { name: 'Install', status: 'open' });

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
});

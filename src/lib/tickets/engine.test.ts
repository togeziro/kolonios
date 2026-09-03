import { describe, expect, it } from 'vitest';
import {
  MAX_ACTIVE_TICKETS,
  FIELD_TASK_TYPES,
  domainOf,
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
  resolveDetailLegAction
} from './engine';
import type { EligibilityProfile, LegRow, RequirementRow } from './engine';

const activeProfile: EligibilityProfile = {
  status: 'active',
  department_id: 1,
  designation_id: 2,
  location_id: 3,
  skills: ['Fiber Optic']
};

function leg(overrides: Partial<LegRow> & Pick<LegRow, 'id' | 'leg_number' | 'status'>): LegRow {
  return {
    name: `Leg ${overrides.leg_number}`,
    description: '',
    assignee_id: null,
    taken_at: null,
    completed_at: null,
    notes: '',
    ...overrides
  };
}

describe('ticket engine (pure functions)', () => {
  describe('MAX_ACTIVE_TICKETS', () => {
    it('is 3', () => {
      expect(MAX_ACTIVE_TICKETS).toBe(3);
    });
  });

  describe('FIELD_TASK_TYPES / domainOf', () => {
    it('classifies installation, maintenance, inspection as field', () => {
      for (const t of ['installation', 'maintenance', 'inspection']) {
        expect(domainOf(t)).toBe('field');
      }
    });

    it('classifies data, sales, others as backoffice', () => {
      for (const t of ['data', 'sales', 'others']) {
        expect(domainOf(t)).toBe('backoffice');
      }
    });

    it('exports exactly the three field task types', () => {
      expect([...FIELD_TASK_TYPES]).toEqual(['installation', 'maintenance', 'inspection']);
    });
  });

  describe('unmetRequirementReasons', () => {
    it('returns no reasons when there are no requirements', () => {
      expect(unmetRequirementReasons([], activeProfile)).toEqual([]);
    });

    it('passes when every requirement dimension matches', () => {
      const reqs: RequirementRow[] = [
        { department_id: 1, designation_id: 2, location_id: 3, skill: 'Fiber Optic' }
      ];
      expect(unmetRequirementReasons(reqs, activeProfile)).toEqual([]);
    });

    it('flags a missing skill', () => {
      const reqs: RequirementRow[] = [
        { department_id: null, designation_id: null, location_id: null, skill: 'Splicing' }
      ];
      expect(unmetRequirementReasons(reqs, activeProfile)).toEqual(['Requires skill: Splicing']);
    });

    it('flags a different department', () => {
      const reqs: RequirementRow[] = [
        { department_id: 99, designation_id: null, location_id: null, skill: null }
      ];
      expect(unmetRequirementReasons(reqs, activeProfile)).toEqual([
        'Requires a different department'
      ]);
    });

    it('flags a different designation', () => {
      const reqs: RequirementRow[] = [
        { department_id: null, designation_id: 99, location_id: null, skill: null }
      ];
      expect(unmetRequirementReasons(reqs, activeProfile)).toEqual([
        'Requires a different designation'
      ]);
    });

    it('flags being outside the assigned location', () => {
      const reqs: RequirementRow[] = [
        { department_id: null, designation_id: null, location_id: 99, skill: null }
      ];
      expect(unmetRequirementReasons(reqs, activeProfile)).toEqual([
        'Outside your assigned location'
      ]);
    });

    it('flags an inactive account even with no requirements', () => {
      const reasons = unmetRequirementReasons([], { ...activeProfile, status: 'inactive' });
      expect(reasons).toEqual(['Your account is not active']);
    });

    it('collects one reason per unmet requirement without duplicates', () => {
      const reqs: RequirementRow[] = [
        { department_id: 99, designation_id: null, location_id: null, skill: null },
        { department_id: 98, designation_id: null, location_id: null, skill: null },
        { department_id: null, designation_id: null, location_id: null, skill: 'Splicing' }
      ];
      const reasons = unmetRequirementReasons(reqs, activeProfile);
      expect(reasons).toEqual(['Requires a different department', 'Requires skill: Splicing']);
    });

    it('deduplicates identical reasons from multiple requirements', () => {
      const reqs: RequirementRow[] = [
        { department_id: null, designation_id: null, location_id: null, skill: 'Splicing' },
        { department_id: null, designation_id: null, location_id: null, skill: 'Splicing' }
      ];
      expect(unmetRequirementReasons(reqs, activeProfile)).toHaveLength(1);
    });

    it('ignores null requirement dimensions', () => {
      const reqs: RequirementRow[] = [
        { department_id: null, designation_id: null, location_id: null, skill: null }
      ];
      expect(unmetRequirementReasons(reqs, activeProfile)).toEqual([]);
    });
  });

  describe('ticketToDomain', () => {
    const baseRow = {
      id: 7,
      ticket_code: 'T-7',
      title: 'Install router',
      description: 'Replace OLT',
      channel: 'field' as const,
      asset_name: 'ONT-42',
      task_type: 'installation' as const,
      status: 'open' as const,
      priority: 'medium' as const,
      due_at: new Date('2024-01-02T00:00:00Z'),
      estimated_minutes: 60,
      assigned_to: null,
      taken_by: null,
      taken_at: null,
      rating: null,
      review_note: '',
      reviewed_by: null,
      completed_at: null,
      created_at: new Date('2024-01-01T10:00:00Z')
    };

    const reqs: RequirementRow[] = [
      { department_id: null, designation_id: null, location_id: null, skill: 'Fiber Optic' },
      { department_id: null, designation_id: null, location_id: null, skill: null }
    ];

    it('maps a row with joined customer/location to the API shape', () => {
      const ticket = ticketToDomain(baseRow, reqs, {
        customer: {
          id: 'cust-1',
          name: 'PT Maju',
          phone: '+62',
          address: 'Jl. Test 1',
          latitude: -6.2,
          longitude: 106.8
        },
        location: { id: 5, name: 'Kantor Pusat' },
        creatorName: 'Admin User'
      });

      expect(ticket.id).toBe(7);
      expect(ticket.ticketCode).toBe('T-7');
      expect(ticket.title).toBe('Install router');
      expect(ticket.domain).toBe('field');
      expect(ticket.status).toBe('open');
      expect(ticket.customer).toMatchObject({ id: 'cust-1', name: 'PT Maju' });
      expect(ticket.location).toEqual({ id: 5, name: 'Kantor Pusat' });
      expect(ticket.requiredSkills).toEqual(['Fiber Optic']);
      expect(ticket.createdByName).toBe('Admin User');
      expect(ticket.dueAt).toBe('2024-01-02T00:00:00.000Z');
      expect(ticket.createdAt).toBe('2024-01-01T10:00:00.000Z');
      expect(ticket.takenAt).toBeNull();
      expect(ticket.completedAt).toBeNull();
    });

    it('derives domain from task type, not stored value', () => {
      const ticket = ticketToDomain({ ...baseRow, task_type: 'data' }, [], {
        customer: null,
        location: null
      });
      expect(ticket.domain).toBe('backoffice');
    });

    it('normalizes empty review note to null and defaults creator name', () => {
      const ticket = ticketToDomain(baseRow, [], { customer: null, location: null });
      expect(ticket.reviewNote).toBeNull();
      expect(ticket.createdByName).toBeNull();
      expect(ticket.customer).toBeNull();
      expect(ticket.location).toBeNull();
      expect(ticket.requiredSkills).toEqual([]);
    });

    it('serializes taken/completed timestamps as ISO strings', () => {
      const ticket = ticketToDomain(
        {
          ...baseRow,
          status: 'completed',
          rating: 5,
          review_note: 'Missing photo evidence',
          reviewed_by: 'reviewer-1',
          taken_by: 'tech-1',
          taken_at: new Date('2024-01-03T08:00:00Z'),
          completed_at: new Date('2024-01-03T09:30:00Z')
        },
        [],
        { customer: null, location: null }
      );
      expect(ticket.takenAt).toBe('2024-01-03T08:00:00.000Z');
      expect(ticket.completedAt).toBe('2024-01-03T09:30:00.000Z');
      expect(ticket.rating).toBe(5);
      expect(ticket.reviewNote).toBe('Missing photo evidence');
      expect(ticket.reviewedBy).toBe('reviewer-1');
    });
  });

  describe('legToDomain', () => {
    it('maps a leg row with ISO timestamps', () => {
      const leg = legToDomain({
        id: 11,
        leg_number: 2,
        name: 'Install',
        description: 'Run fiber',
        status: 'in_progress',
        assignee_id: 'tech-1',
        taken_at: new Date('2024-01-03T08:00:00Z'),
        completed_at: null,
        notes: ''
      });
      expect(leg).toEqual({
        id: 11,
        legNumber: 2,
        name: 'Install',
        description: 'Run fiber',
        status: 'in_progress',
        assigneeId: 'tech-1',
        takenAt: '2024-01-03T08:00:00.000Z',
        completedAt: null,
        notes: ''
      });
    });
  });

  describe('materialToDomain', () => {
    it('attaches the leg name', () => {
      const material = materialToDomain(
        {
          id: 3,
          leg_id: 11,
          material_name: 'Drop cable',
          qty: 15,
          unit: 'm',
          source: 'van',
          barcode: ''
        },
        'Install'
      );
      expect(material).toEqual({
        id: 3,
        legId: 11,
        legName: 'Install',
        materialName: 'Drop cable',
        qty: 15,
        unit: 'm',
        source: 'van',
        barcode: ''
      });
    });
  });

  describe('worklogToDomain', () => {
    it('maps a worklog row', () => {
      const entry = worklogToDomain({
        id: 9,
        leg_id: 11,
        kind: 'meter',
        body: '855 nm',
        created_at: new Date('2024-01-03T08:05:00Z'),
        created_by: 'tech-1'
      });
      expect(entry).toEqual({
        id: 9,
        legId: 11,
        kind: 'meter',
        body: '855 nm',
        createdAt: '2024-01-03T08:05:00.000Z',
        createdBy: 'tech-1'
      });
    });
  });

  describe('pickSubmittableLeg', () => {
    it('returns null for an empty ticket', () => {
      expect(pickSubmittableLeg([])).toBeNull();
    });

    it('prefers the in-progress leg over an earlier open leg', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'open' }),
        leg({ id: 2, leg_number: 2, status: 'in_progress' })
      ];
      expect(pickSubmittableLeg(legs)?.id).toBe(2);
    });

    it('picks the lowest-numbered leg when none is in progress', () => {
      const legs = [
        leg({ id: 5, leg_number: 2, status: 'open' }),
        leg({ id: 3, leg_number: 1, status: 'assigned' })
      ];
      expect(pickSubmittableLeg(legs)?.id).toBe(3);
    });

    it('blocks re-submission when the top pick is submitted, even with open legs later', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'assigned' })
      ];
      expect(pickSubmittableLeg(legs)).toBeNull();
    });

    it('returns null when every leg is submitted or completed', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'completed' })
      ];
      expect(pickSubmittableLeg(legs)).toBeNull();
    });

    it('prefers the lowest-numbered leg among multiple in-progress legs', () => {
      const legs = [
        leg({ id: 7, leg_number: 3, status: 'in_progress' }),
        leg({ id: 6, leg_number: 2, status: 'in_progress' })
      ];
      expect(pickSubmittableLeg(legs)?.id).toBe(6);
    });
  });

  describe('resolveSubmittedNotes', () => {
    it('uses the submitted notes when provided', () => {
      expect(resolveSubmittedNotes('Original', 'Spliced and tested')).toBe('Spliced and tested');
    });

    it('preserves existing notes when submission is empty', () => {
      expect(resolveSubmittedNotes('Handoff: Send courier', '')).toBe('Handoff: Send courier');
    });
  });

  describe('resolveLegAdvance', () => {
    it('advances to the next open leg after the submitted one', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'open', name: 'Install' })
      ];
      expect(resolveLegAdvance(1, legs)).toEqual({
        kind: 'advance',
        nextLeg: { id: 2, legNumber: 2, name: 'Install' }
      });
    });

    it('advances to a pre-assigned later leg', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'assigned', name: 'Install', assignee_id: 'user-b' })
      ];
      expect(resolveLegAdvance(1, legs)).toMatchObject({ kind: 'advance', nextLeg: { id: 2 } });
    });

    it('completes the ticket when no advanceable legs remain', () => {
      const legs = [leg({ id: 1, leg_number: 1, status: 'in_progress' })];
      expect(resolveLegAdvance(1, legs)).toEqual({ kind: 'complete' });
    });

    it('ignores earlier legs and already-submitted legs', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'open' }),
        leg({ id: 2, leg_number: 2, status: 'in_progress' }),
        leg({ id: 3, leg_number: 3, status: 'submitted' })
      ];
      expect(resolveLegAdvance(2, legs)).toEqual({ kind: 'complete' });
    });

    it('picks the lowest-numbered candidate when several are open', () => {
      const legs = [
        leg({ id: 3, leg_number: 3, status: 'open', name: 'C' }),
        leg({ id: 2, leg_number: 2, status: 'open', name: 'B' })
      ];
      expect(resolveLegAdvance(1, legs)).toEqual({
        kind: 'advance',
        nextLeg: { id: 2, legNumber: 2, name: 'B' }
      });
    });
  });

  describe('pickClaimableLeg', () => {
    it('returns null for an empty ticket', () => {
      expect(pickClaimableLeg([])).toBeNull();
    });

    it('picks the next assigned leg with no assignee after a submitted leg', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'assigned', assignee_id: null })
      ];
      expect(pickClaimableLeg(legs)?.id).toBe(2);
    });

    it('returns null when the next leg is already claimed', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'assigned', assignee_id: 'user-a' })
      ];
      expect(pickClaimableLeg(legs)).toBeNull();
    });

    it('blocks a later leg when an earlier leg is still open', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'open' }),
        leg({ id: 3, leg_number: 3, status: 'assigned', assignee_id: null })
      ];
      expect(pickClaimableLeg(legs)).toBeNull();
    });

    it('blocks a non-sequential leg when an earlier assigned leg is unclaimed', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'assigned', assignee_id: null }),
        leg({ id: 3, leg_number: 3, status: 'assigned', assignee_id: null })
      ];
      expect(pickClaimableLeg(legs)?.id).toBe(2);
    });

    it('returns null when every leg is submitted or completed', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'completed' })
      ];
      expect(pickClaimableLeg(legs)).toBeNull();
    });

    it('returns null when the next leg is in progress', () => {
      const legs = [
        leg({ id: 1, leg_number: 1, status: 'submitted' }),
        leg({ id: 2, leg_number: 2, status: 'in_progress' })
      ];
      expect(pickClaimableLeg(legs)).toBeNull();
    });
  });

  describe('formatHandoffNote', () => {
    it('creates a fresh handoff note on an empty leg', () => {
      expect(formatHandoffNote('', 'Send courier')).toBe('Handoff: Send courier');
    });

    it('appends to existing notes with a newline separator', () => {
      expect(formatHandoffNote('Spliced', 'Courier: Budi')).toBe('Spliced\nHandoff: Courier: Budi');
    });
  });

  describe('formatArrivalBody', () => {
    it('formats finite coordinates with accuracy', () => {
      expect(formatArrivalBody({ latitude: -6.2, longitude: 106.8, accuracy: 12 })).toBe(
        '-6.2,106.8 ±12m'
      );
    });

    it('falls back when coordinates are not finite numbers', () => {
      expect(formatArrivalBody({ latitude: Number.NaN, longitude: 106.8, accuracy: 12 })).toBe(
        'arrived (no location fix)'
      );
    });

    it('falls back when there is no location fix at all', () => {
      expect(formatArrivalBody(undefined)).toBe('arrived (no location fix)');
    });
  });

  describe('resolveDetailLegAction', () => {
    const base = {
      status: 'in_progress' as const,
      isHolder: false,
      startableLegId: null,
      claimableLegId: null,
      claimEligibilityReasons: [] as string[]
    };

    it('is none for open tickets (Take flow is separate)', () => {
      expect(resolveDetailLegAction({ ...base, status: 'open' })).toEqual({ kind: 'none' });
    });

    it('offers start-leg to the holder with a startable leg', () => {
      expect(resolveDetailLegAction({ ...base, isHolder: true, startableLegId: 7 })).toEqual({
        kind: 'start-leg',
        legId: 7
      });
    });

    it('is none for a holder with no startable leg', () => {
      expect(resolveDetailLegAction({ ...base, isHolder: true })).toEqual({ kind: 'none' });
    });

    it('offers claim-leg to a non-holder with a claimable pool leg', () => {
      expect(resolveDetailLegAction({ ...base, claimableLegId: 9 })).toEqual({
        kind: 'claim-leg',
        legId: 9,
        reasons: []
      });
    });

    it('carries eligibility reasons on a blocked claim', () => {
      expect(
        resolveDetailLegAction({
          ...base,
          claimableLegId: 9,
          claimEligibilityReasons: ['Requires skill: Fiber Optic']
        })
      ).toEqual({ kind: 'claim-leg', legId: 9, reasons: ['Requires skill: Fiber Optic'] });
    });

    it('is none for a non-holder with no claimable leg', () => {
      expect(resolveDetailLegAction(base)).toEqual({ kind: 'none' });
    });
  });
});

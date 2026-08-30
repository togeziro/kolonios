import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getCompletedLegsCountForDay, getCompletedLegsCountsForKeys } from './checklists';
import { resetAllTables, seedUser, seedTicket, seedTicketLeg } from '@/test-utils/db';

const USER_A = 'checklist-user-a';
const USER_B = 'checklist-user-b';

// 2026-08-30 business day in Asia/Jakarta (WIB, UTC+7) spans
// 2026-08-29T17:00:00Z .. 2026-08-30T17:00:00Z in UTC.
const DATE = '2026-08-30';

async function seedCompletedLeg(
  ticketId: number,
  assigneeId: string,
  completedAtUtc: string,
  overrides: Parameters<typeof seedTicketLeg>[1] = {}
) {
  return seedTicketLeg(ticketId, {
    status: 'completed',
    assignee_id: assigneeId,
    completed_at: new Date(completedAtUtc),
    ...overrides
  });
}

describe('checklists data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('getCompletedLegsCountForDay', () => {
    it('counts completed legs for the user on the business date', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket();
      // 08:00, 14:00, 22:30 WIB — all inside 2026-08-30 WIB
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T01:00:00Z');
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T07:00:00Z');
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T15:30:00Z');

      expect(await getCompletedLegsCountForDay(USER_A, DATE)).toBe(3);
    });

    it('respects the WIB timezone boundary for the business date', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket();
      // 2026-08-30T17:55:00Z = 2026-08-31T00:55 WIB → belongs to Aug 31
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T17:55:00Z');
      // 2026-08-29T17:10:00Z = 2026-08-30T00:10 WIB → belongs to Aug 30
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-29T17:10:00Z');

      expect(await getCompletedLegsCountForDay(USER_A, '2026-08-30')).toBe(1);
      expect(await getCompletedLegsCountForDay(USER_A, '2026-08-31')).toBe(1);
    });

    it('excludes non-completed legs and completed legs with null completed_at', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket();
      // in_progress with completed_at set — must not count
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T02:00:00Z', {
        status: 'in_progress'
      });
      // completed with null completed_at — must not count
      await seedTicketLeg(ticket.id, {
        status: 'completed',
        assignee_id: USER_A,
        completed_at: null
      });
      // one valid completed leg
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T03:00:00Z');

      expect(await getCompletedLegsCountForDay(USER_A, DATE)).toBe(1);
    });

    it('excludes other users completed legs', async () => {
      await seedUser(USER_A);
      await seedUser(USER_B);
      const ticket = await seedTicket();
      await seedCompletedLeg(ticket.id, USER_B, '2026-08-30T02:00:00Z');
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T03:00:00Z');

      expect(await getCompletedLegsCountForDay(USER_A, DATE)).toBe(1);
      expect(await getCompletedLegsCountForDay(USER_B, DATE)).toBe(1);
    });

    it('counts Field and Non-field task types together', async () => {
      await seedUser(USER_A);
      const fieldTicket = await seedTicket({ task_type: 'installation' });
      const nonFieldTicket = await seedTicket({ task_type: 'data' });
      await seedCompletedLeg(fieldTicket.id, USER_A, '2026-08-30T02:00:00Z');
      await seedCompletedLeg(nonFieldTicket.id, USER_A, '2026-08-30T03:00:00Z');

      expect(await getCompletedLegsCountForDay(USER_A, DATE)).toBe(2);
    });

    it('counts dynamic legs added to an existing ticket', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket();
      // Two initial legs from ticket creation
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T02:00:00Z');
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T03:00:00Z');
      // Third leg appended later — seedTicketLeg auto-assigns the next leg_number
      const dynamicLeg = await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T04:00:00Z');

      expect(dynamicLeg.leg_number).toBe(3);
      expect(await getCompletedLegsCountForDay(USER_A, DATE)).toBe(3);
    });
  });

  describe('getCompletedLegsCountsForKeys', () => {
    it('buckets completed legs per user and date across multiple keys', async () => {
      await seedUser(USER_A);
      await seedUser(USER_B);
      const ticketA = await seedTicket();
      const ticketB = await seedTicket();

      // USER_A: 2 legs on 2026-08-30, 1 leg on 2026-08-31
      await seedCompletedLeg(ticketA.id, USER_A, '2026-08-30T01:00:00Z');
      await seedCompletedLeg(ticketA.id, USER_A, '2026-08-30T07:00:00Z');
      await seedCompletedLeg(ticketA.id, USER_A, '2026-08-30T18:00:00Z'); // Aug 31 WIB
      // USER_B: 1 leg on 2026-08-30
      await seedCompletedLeg(ticketB.id, USER_B, '2026-08-30T03:00:00Z');

      const counts = await getCompletedLegsCountsForKeys([
        { userId: USER_A, date: '2026-08-30' },
        { userId: USER_A, date: '2026-08-31' },
        { userId: USER_B, date: '2026-08-30' },
        { userId: USER_B, date: '2026-08-31' }
      ]);

      expect(counts.get(`${USER_A}|2026-08-30`)).toBe(2);
      expect(counts.get(`${USER_A}|2026-08-31`)).toBe(1);
      expect(counts.get(`${USER_B}|2026-08-30`)).toBe(1);
      expect(counts.get(`${USER_B}|2026-08-31`)).toBe(0);
    });

    it('returns an empty Map for an empty keys array', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket();
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T01:00:00Z');

      const counts = await getCompletedLegsCountsForKeys([]);
      expect(counts).toBeInstanceOf(Map);
      expect(counts.size).toBe(0);
    });

    it('defaults unknown keys to 0 without counting unrelated legs', async () => {
      await seedUser(USER_A);
      const ticket = await seedTicket();
      await seedCompletedLeg(ticket.id, USER_A, '2026-08-30T01:00:00Z');

      const counts = await getCompletedLegsCountsForKeys([
        { userId: 'unknown-user', date: '2026-08-30' },
        { userId: USER_A, date: '2026-08-29' }
      ]);

      expect(counts.get('unknown-user|2026-08-30')).toBe(0);
      expect(counts.get(`${USER_A}|2026-08-29`)).toBe(0);
      expect(counts.size).toBe(2);
    });
  });
});

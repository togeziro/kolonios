import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  bulkAssignSchedule,
  createScheduleAssignment,
  getEffectiveEmployeeSchedule,
  getMonthlyScheduleData
} from './attendance';
import {
  resetAllTables,
  seedShift,
  seedShiftWeekdayRule,
  seedScheduleAssignment
} from '@/test-utils/db';
import { ensureScheduleRangeCheck, withInvertedRangeRows } from '@/test-utils/schedule-range';
import { db } from '@/lib/db';
import { scheduleAssignments } from './schema/attendance';

const TEST_USER_ID = 'test-user-inverted-range';

/**
 * Opsi B — inverted-range hardening for `schedule_assignments`.
 *
 * Prod incident: an auto-close wrote `effective_from > effective_to`
 * (2026-09-14 → 2026-09-07) and the row kept winning overlap selection.
 * These tests lock in:
 *  - write-side guards rejecting `effectiveTo <= effectiveFrom`, and
 *  - read-side exclusion of pre-existing inverted rows.
 *
 * The canonical fix pin is the `getMonthlyScheduleData` test: it is the only
 * reader whose `ORDER BY effective_from DESC LIMIT 1` pick an overlapping
 * inverted row can actually win (see the note on the point-query test).
 */

async function countAssignments(userId: string) {
  return db.select().from(scheduleAssignments).where(eq(scheduleAssignments.user_id, userId));
}

describe('schedule_assignments inverted-range hardening (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('createScheduleAssignment — range guard', () => {
    it('rejects effectiveTo equal to effectiveFrom without writing', async () => {
      const shift = await seedShift({ name: 'Guarded' });
      const res = await createScheduleAssignment({
        userId: TEST_USER_ID,
        shiftId: shift.id,
        effectiveFrom: '2026-09-08',
        effectiveTo: '2026-09-08',
        createdBy: 'test-admin'
      });

      expect(res.success).toBe(false);
      expect(res).toMatchObject({ error: 'effectiveToBeforeFrom' });
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
    });

    it('rejects effectiveTo before effectiveFrom without writing', async () => {
      const shift = await seedShift({ name: 'Guarded' });
      const res = await createScheduleAssignment({
        userId: TEST_USER_ID,
        shiftId: shift.id,
        effectiveFrom: '2026-09-14',
        effectiveTo: '2026-09-07',
        createdBy: 'test-admin'
      });

      expect(res.success).toBe(false);
      expect(res).toMatchObject({ error: 'effectiveToBeforeFrom' });
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
    });

    it('accepts a bounded valid range', async () => {
      const shift = await seedShift({ name: 'Guarded' });
      const bounded = await createScheduleAssignment({
        userId: TEST_USER_ID,
        shiftId: shift.id,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
        createdBy: 'test-admin'
      });

      expect(bounded.success).toBe(true);
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(1);
    });

    it("rejects a missing effectiveTo with 'effectiveToRequired' (bounded only)", async () => {
      const shift = await seedShift({ name: 'Guarded' });
      // Deliberately incomplete payload (escaped via unknown): the runtime
      // guard must reject what the type system normally prevents.
      const res = await createScheduleAssignment({
        userId: TEST_USER_ID,
        shiftId: shift.id,
        effectiveFrom: '2026-10-01',
        createdBy: 'test-admin'
      } as unknown as {
        userId: string;
        shiftId: number;
        effectiveFrom: string;
        effectiveTo: string;
        createdBy?: string;
      });

      expect(res.success).toBe(false);
      expect(res).toMatchObject({ error: 'effectiveToRequired' });
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
    });
  });

  describe('bulkAssignSchedule — range guard', () => {
    it('rejects the whole batch when one entry is inverted (nothing written)', async () => {
      const shift = await seedShift({ name: 'Bulk Guarded' });
      const res = await bulkAssignSchedule(
        [
          {
            userId: TEST_USER_ID,
            shiftId: shift.id,
            effectiveFrom: '2026-09-01',
            effectiveTo: '2026-09-30'
          },
          {
            userId: TEST_USER_ID,
            shiftId: shift.id,
            effectiveFrom: '2026-09-14',
            effectiveTo: '2026-09-07'
          }
        ],
        'test-admin'
      );

      expect(res.success).toBe(false);
      expect(res).toMatchObject({ error: 'effectiveToBeforeFrom' });
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
    });

    it('rejects the whole batch when one entry is missing effectiveTo (nothing written)', async () => {
      const shift = await seedShift({ name: 'Bulk Guarded' });
      const res = await bulkAssignSchedule(
        [
          {
            userId: TEST_USER_ID,
            shiftId: shift.id,
            effectiveFrom: '2026-09-01',
            effectiveTo: '2026-09-30'
          },
          { userId: TEST_USER_ID, shiftId: shift.id, effectiveFrom: '2026-10-01' }
        ] as Array<{
          userId: string;
          shiftId: number;
          effectiveFrom: string;
          effectiveTo: string;
        }>,
        'test-admin'
      );

      expect(res.success).toBe(false);
      expect(res).toMatchObject({ error: 'effectiveToRequired' });
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
    });

    it('accepts an all-valid batch', async () => {
      const shift = await seedShift({ name: 'Bulk Guarded' });
      const res = await bulkAssignSchedule(
        [
          {
            userId: TEST_USER_ID,
            shiftId: shift.id,
            effectiveFrom: '2026-09-01',
            effectiveTo: '2026-09-30'
          },
          {
            userId: TEST_USER_ID,
            shiftId: shift.id,
            effectiveFrom: '2026-10-01',
            effectiveTo: '2026-10-31'
          }
        ],
        'test-admin'
      );

      expect(res.success).toBe(true);
      if (res.success) expect(res.count).toBe(2);
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(2);
    });
  });

  describe('readers skip pre-existing inverted rows', () => {
    it('getMonthlyScheduleData picks the valid row over an inverted one (canonical fix pin)', async () => {
      const staleShift = await seedShift({ name: 'Inverted' });
      const validShift = await seedShift({ name: 'Valid' });
      await seedShiftWeekdayRule(staleShift.id, { day_of_week: 4 });
      await seedShiftWeekdayRule(validShift.id, { day_of_week: 4 });

      // Bypass the write guards with a raw insert — mirrors prod dhani id=1.
      await withInvertedRangeRows(async () => {
        await db.insert(scheduleAssignments).values({
          user_id: TEST_USER_ID,
          shift_id: staleShift.id,
          effective_from: '2026-09-14',
          effective_to: '2026-09-07'
        });
        await seedScheduleAssignment({
          user_id: TEST_USER_ID,
          shift_id: validShift.id,
          effective_from: '2026-09-08',
          effective_to: '2026-09-30'
        });

        // Both rows overlap the month under the OLD overlap-only SQL; without
        // the hardening the inverted row reaches the assignment list. This
        // assertion fails pre-fix.
        const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-09');
        expect(res.assignments).toHaveLength(1);
        expect(res.assignments[0].shiftId).toBe(validShift.id);
      });
    });

    it('getMonthlyScheduleData returns null when only an inverted row exists', async () => {
      const staleShift = await seedShift({ name: 'Inverted Only' });
      await seedShiftWeekdayRule(staleShift.id, { day_of_week: 4 });

      await withInvertedRangeRows(async () => {
        await db.insert(scheduleAssignments).values({
          user_id: TEST_USER_ID,
          shift_id: staleShift.id,
          effective_from: '2026-09-14',
          effective_to: '2026-09-07'
        });

        const res = await getMonthlyScheduleData(TEST_USER_ID, '2026-09');
        expect(res.assignments).toEqual([]);
      });
    });

    it('getEffectiveEmployeeSchedule resolves the valid row (behavior lock — point queries are inherently immune)', async () => {
      const staleShift = await seedShift({ name: 'Inverted' });
      const validShift = await seedShift({ name: 'Valid' });
      // 2026-09-10 is a Thursday (dow 4).
      await seedShiftWeekdayRule(staleShift.id, {
        day_of_week: 4,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });
      await seedShiftWeekdayRule(validShift.id, {
        day_of_week: 4,
        is_working_day: true,
        start_time: '09:00',
        end_time: '17:00'
      });

      await withInvertedRangeRows(async () => {
        await db.insert(scheduleAssignments).values({
          user_id: TEST_USER_ID,
          shift_id: staleShift.id,
          effective_from: '2026-09-14',
          effective_to: '2026-09-07'
        });
        await seedScheduleAssignment({
          user_id: TEST_USER_ID,
          shift_id: validShift.id,
          effective_from: '2026-09-08',
          effective_to: '2026-09-30'
        });

        // A single-date pick matches iff `from <= date AND to >= date`, which
        // is impossible when `from > to` — so an inverted row can never win a
        // point query even without the new SQL predicate. This test pins that
        // behavior (the monthly test above is the one that actually exercises
        // the fix).
        const res = await getEffectiveEmployeeSchedule(TEST_USER_ID, '2026-09-10');
        expect(res).not.toBeNull();
        expect(res!.shiftId).toBe(validShift.id);
      });
    });

    it('CHECK constraint blocks a raw inverted insert (migration proof)', async () => {
      const shift = await seedShift({ name: 'Constrained' });
      // Ensure the constraint under test exists regardless of test order
      // (post-migration it ships with the schema; pre-migration the helper
      // adds the identical definition).
      await ensureScheduleRangeCheck();
      await expect(
        db.insert(scheduleAssignments).values({
          user_id: TEST_USER_ID,
          shift_id: shift.id,
          effective_from: '2026-09-14',
          effective_to: '2026-09-07'
        })
      ).rejects.toThrow();
      expect(await countAssignments(TEST_USER_ID)).toHaveLength(0);
    });
  });
});

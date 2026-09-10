/**
 * Integration tests for `cell-write.ts` (schedule-grid cell-write seam).
 *
 * The three tx helpers (`writeCellShiftTx` / `writeCellDayOffTx` /
 * `clearCellTx`) own the DELETE-then-INSERT shape behind every write path
 * (single-cell fns, `applyToWholeWeekFn`, `repeatWeekBulkFn`,
 * `importMonthFn`). These tests pin the seam directly — each helper runs
 * inside a real `db.transaction` against the test DB — so the
 * orphan-prevention guard (delete both tables before any insert) is covered
 * at its single source of truth, not just transitively through the server
 * fns in `write-service.integration.test.ts`.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { resetAllTables, seedDateOverride, seedDayOff, seedShift, seedUser } from '@/test-utils/db';
import { db } from '@/lib/db';
import { dateOverrides, dayOffs } from '@/lib/db/schema/attendance';

import { clearCellTx, writeCellDayOffTx, writeCellShiftTx } from './cell-write';

const USER = 'cell-write-test-user';
const DATE = '2026-08-05';

async function readOverride(userId: string, date: string) {
  const rows = await db
    .select()
    .from(dateOverrides)
    .where(and(eq(dateOverrides.user_id, userId), eq(dateOverrides.date, date)));
  return rows[0] ?? null;
}

async function readDayOff(userId: string, date: string) {
  const rows = await db
    .select()
    .from(dayOffs)
    .where(and(eq(dayOffs.user_id, userId), eq(dayOffs.date, date)));
  return rows[0] ?? null;
}

describe('schedule-grid cell-write seam (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedUser(USER);
    await seedShift({ id: 1, name: 'Morning' });
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('writeCellShiftTx inserts the override and clears a masked day_off', async () => {
    await seedDayOff({ user_id: USER, date: DATE, reason: 'Cuti' });

    await db.transaction(async (tx) => {
      await writeCellShiftTx(tx, { userId: USER, date: DATE, shiftId: 1, createdBy: USER });
    });

    const override = await readOverride(USER, DATE);
    expect(override).not.toBeNull();
    expect(override!.shift_id).toBe(1);
    expect(await readDayOff(USER, DATE)).toBeNull();
  });

  it('writeCellShiftTx replaces an existing override (no duplicate)', async () => {
    await seedDateOverride({ user_id: USER, date: DATE, shift_id: 1 });

    await db.transaction(async (tx) => {
      await writeCellShiftTx(tx, { userId: USER, date: DATE, shiftId: 1, createdBy: USER });
    });

    const rows = await db
      .select()
      .from(dateOverrides)
      .where(and(eq(dateOverrides.user_id, USER), eq(dateOverrides.date, DATE)));
    expect(rows).toHaveLength(1);
  });

  it('writeCellDayOffTx inserts the day_off and clears a masked override', async () => {
    await seedDateOverride({ user_id: USER, date: DATE, shift_id: 1 });

    await db.transaction(async (tx) => {
      await writeCellDayOffTx(tx, { userId: USER, date: DATE, reason: 'Sakit', createdBy: USER });
    });

    expect(await readOverride(USER, DATE)).toBeNull();
    const off = await readDayOff(USER, DATE);
    expect(off).not.toBeNull();
    expect(off!.reason).toBe('Sakit');
  });

  it('clearCellTx deletes both rows and leaves other dates alone', async () => {
    await seedDateOverride({ user_id: USER, date: DATE, shift_id: 1 });
    await seedDayOff({ user_id: USER, date: DATE, reason: 'Cuti' });
    await seedDayOff({ user_id: USER, date: '2026-08-06', reason: 'Other day' });

    await db.transaction(async (tx) => {
      await clearCellTx(tx, { userId: USER, date: DATE });
    });

    expect(await readOverride(USER, DATE)).toBeNull();
    expect(await readDayOff(USER, DATE)).toBeNull();
    expect(await readDayOff(USER, '2026-08-06')).not.toBeNull();
  });
});

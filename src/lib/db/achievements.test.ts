import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getAchievementData } from './achievements';
import { db } from '@/lib/db';
import { employeeShifts } from './schema/attendance';
import { seedUser, resetAllTables, seedTicket } from '@/test-utils/db';
import { businessDateInTimeZone } from '@/lib/dates';

const TEST_USER_ID = 'test-user-att-123';

describe('getAchievementData', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedUser(TEST_USER_ID);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('returns zeroed data when no records exist', async () => {
    const result = await getAchievementData(TEST_USER_ID);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(0);
    expect(result.inspectionCompleted).toBe(0);
    expect(result.totalCompleted).toBe(0);
    expect(result.uniqueTaskTypes).toEqual([]);
    expect(result.fastFinisherCount).toBe(0);
    expect(result.weekTasksCompleted).toBe(0);
    expect(result.monthEarlyCheckIns).toBe(0);
    expect(result.monthNightOwlCheckOuts).toBe(0);
  });

  it('counts completed inspection tickets for OLT Master badge', async () => {
    await seedTicket({ task_type: 'inspection', status: 'completed', assigned_to: TEST_USER_ID });
    await seedTicket({ task_type: 'inspection', status: 'completed', assigned_to: TEST_USER_ID });
    await seedTicket({ task_type: 'installation', status: 'completed', assigned_to: TEST_USER_ID });

    const result = await getAchievementData(TEST_USER_ID);
    expect(result.inspectionCompleted).toBe(2);
    expect(result.totalCompleted).toBe(3);
  });

  it('counts unique task types for All-rounder badge', async () => {
    await seedTicket({ task_type: 'installation', status: 'completed', assigned_to: TEST_USER_ID });
    await seedTicket({ task_type: 'maintenance', status: 'completed', assigned_to: TEST_USER_ID });
    await seedTicket({ task_type: 'inspection', status: 'completed', assigned_to: TEST_USER_ID });

    const result = await getAchievementData(TEST_USER_ID);
    expect(result.uniqueTaskTypes).toHaveLength(3);
    expect(result.uniqueTaskTypes).toContain('installation');
    expect(result.uniqueTaskTypes).toContain('maintenance');
    expect(result.uniqueTaskTypes).toContain('inspection');
  });

  it('counts early check-ins (before 07:00) this month', async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await db.insert(employeeShifts).values([
      {
        user_id: TEST_USER_ID,
        date: `${month}-01`,
        check_in_time: '06:45',
        attendance_status: 'present'
      },
      {
        user_id: TEST_USER_ID,
        date: `${month}-02`,
        check_in_time: '06:50',
        attendance_status: 'present'
      },
      {
        user_id: TEST_USER_ID,
        date: `${month}-03`,
        check_in_time: '08:00',
        attendance_status: 'late'
      }
    ]);
    const result = await getAchievementData(TEST_USER_ID);
    expect(result.monthEarlyCheckIns).toBe(2);
  });

  it('counts late check-outs (after 20:00) this month for Night Owl', async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await db.insert(employeeShifts).values([
      {
        user_id: TEST_USER_ID,
        date: `${month}-01`,
        check_in_time: '08:00',
        check_out_time: '20:30',
        attendance_status: 'present'
      },
      {
        user_id: TEST_USER_ID,
        date: `${month}-02`,
        check_in_time: '08:00',
        check_out_time: '21:00',
        attendance_status: 'present'
      }
    ]);
    const result = await getAchievementData(TEST_USER_ID);
    expect(result.monthNightOwlCheckOuts).toBe(2);
  });

  it('computes a streak of consecutive present days ending today', async () => {
    const today = businessDateInTimeZone(new Date());
    const [y, m, d] = today.split('-').map(Number);
    const daysAgo = (n: number) => {
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - n);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    await db.insert(employeeShifts).values([
      { user_id: TEST_USER_ID, date: daysAgo(0), attendance_status: 'present' },
      { user_id: TEST_USER_ID, date: daysAgo(1), attendance_status: 'present' },
      { user_id: TEST_USER_ID, date: daysAgo(2), attendance_status: 'present' },
      { user_id: TEST_USER_ID, date: daysAgo(5), attendance_status: 'absent' }
    ]);
    const result = await getAchievementData(TEST_USER_ID);
    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });

  it('counts tickets completed this week', async () => {
    await seedTicket({
      task_type: 'maintenance',
      status: 'completed',
      assigned_to: TEST_USER_ID,
      completed_at: new Date()
    });
    const result = await getAchievementData(TEST_USER_ID);
    expect(result.weekTasksCompleted).toBe(1);
  });
});

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  getMyTasks,
  getAvailableTasks,
  getTaskDetail,
  takeTask,
  completeTask,
  MAX_ACTIVE_TASKS
} from './tasks';
import { db } from '@/lib/db';
import { tasks } from './schema/tasks';
import {
  resetAllTables,
  seedUser,
  seedDepartment,
  seedDesignation,
  seedLocation,
  seedEmployee,
  seedTask,
  seedTaskRequirement,
  seedEmployeeSkill
} from '@/test-utils/db';

const USER_A = 'task-user-a';
const USER_B = 'task-user-b';

describe('tasks data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('getMyTasks', () => {
    it('returns empty when user has no tasks', async () => {
      const res = await getMyTasks(USER_A);
      expect(res.success).toBe(true);
      expect(res.tasks).toHaveLength(0);
    });

    it('returns assigned and in-progress tasks for the user only', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      await seedTask({
        title: 'Mine assigned',
        assigned_to: USER_A,
        status: 'assigned',
        created_by: 'seed'
      });
      await seedTask({
        title: 'Mine in progress',
        taken_by: USER_A,
        status: 'in_progress',
        created_by: 'seed'
      });
      await seedTask({
        title: 'Not mine',
        assigned_to: USER_B,
        status: 'assigned',
        created_by: 'seed'
      });
      await seedTask({ title: 'Pool only', status: 'available', created_by: 'seed' });

      const res = await getMyTasks(USER_A);
      expect(res.success).toBe(true);
      expect(res.tasks).toHaveLength(2);
      expect(res.tasks.map((t) => t.title).toSorted()).toEqual([
        'Mine assigned',
        'Mine in progress'
      ]);
    });
  });

  describe('getAvailableTasks', () => {
    it('returns only tasks whose requirements match the user', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      await seedEmployeeSkill(USER_A, 'Fiber Optic');

      const matching = await seedTask({ title: 'Match', status: 'available', created_by: 'seed' });
      await seedTaskRequirement(matching.id, {
        designation_id: designation.id,
        skill: 'Fiber Optic'
      });

      const wrongDept = await seedTask({
        title: 'Wrong dept',
        status: 'available',
        created_by: 'seed'
      });
      const otherDept = await seedDepartment({ name: 'Finance', code: 'FIN' });
      await seedTaskRequirement(wrongDept.id, { department_id: otherDept.id });

      const noSkill = await seedTask({
        title: 'No skill',
        status: 'available',
        created_by: 'seed'
      });
      await seedTaskRequirement(noSkill.id, { skill: 'Networking' });

      const res = await getAvailableTasks(USER_A, {});
      expect(res.success).toBe(true);
      expect(res.tasks.map((t) => t.title)).toEqual(['Match']);
      expect(res.unavailable.map((t) => t.title).toSorted()).toEqual(['No skill', 'Wrong dept']);
      expect(res.unavailable.find((t) => t.title === 'No skill')?.eligibilityReasons).toContain(
        'Requires skill: Networking'
      );
    });

    it('respects location and designation requirements', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      const otherLoc = await seedLocation({ name: 'Other Branch' });

      const locTask = await seedTask({
        title: 'Loc match',
        status: 'available',
        created_by: 'seed'
      });
      await seedTaskRequirement(locTask.id, { location_id: location.id });

      const locMiss = await seedTask({
        title: 'Loc miss',
        status: 'available',
        created_by: 'seed'
      });
      await seedTaskRequirement(locMiss.id, { location_id: otherLoc.id });

      const desigMiss = await seedTask({
        title: 'Desig miss',
        status: 'available',
        created_by: 'seed'
      });
      const otherDesig = await seedDesignation(department.id, { name: 'Analyst', code: 'ANL' });
      await seedTaskRequirement(desigMiss.id, { designation_id: otherDesig.id });

      const res = await getAvailableTasks(USER_A, {});
      expect(res.tasks.map((t) => t.title)).toEqual(['Loc match']);
      expect(res.unavailable.map((t) => t.title).toSorted()).toEqual(['Desig miss', 'Loc miss']);
    });

    it('filters by priority and location when filters are passed', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      await seedTask({
        title: 'High loc',
        status: 'available',
        priority: 'high',
        location_id: location.id,
        created_by: 'seed'
      });
      await seedTask({
        title: 'Low loc',
        status: 'available',
        priority: 'low',
        location_id: location.id,
        created_by: 'seed'
      });

      const res = await getAvailableTasks(USER_A, { locationId: location.id, priority: 'high' });
      expect(res.tasks.map((t) => t.title)).toEqual(['High loc']);
    });
  });

  describe('getTaskDetail', () => {
    it('returns only tasks owned by the user', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const mine = await seedTask({
        title: 'Mine',
        assigned_to: USER_A,
        status: 'assigned',
        created_by: 'seed'
      });
      const notMine = await seedTask({
        title: 'Not mine',
        assigned_to: USER_B,
        status: 'assigned',
        created_by: 'seed'
      });

      const ok = await getTaskDetail(USER_A, mine.id);
      expect(ok.success).toBe(true);
      expect(ok.task?.title).toBe('Mine');

      const denied = await getTaskDetail(USER_A, notMine.id);
      expect(denied.success).toBe(false);
    });
  });

  describe('takeTask', () => {
    it('claims an eligible available task', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      const task = await seedTask({ title: 'Pool task', status: 'available', created_by: 'seed' });

      const res = await takeTask(USER_A, task.id);
      expect(res.success).toBe(true);
      expect(res.task?.status).toBe('in_progress');
      expect(res.task?.takenBy).toBe(USER_A);

      const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
      expect(row!.status).toBe('in_progress');
      expect(row!.taken_by).toBe(USER_A);
    });

    it('rejects a task the user is not eligible for', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      const otherDept = await seedDepartment({ name: 'Finance', code: 'FIN' });
      const task = await seedTask({ title: 'Wrong dept', status: 'available', created_by: 'seed' });
      await seedTaskRequirement(task.id, { department_id: otherDept.id });

      const res = await takeTask(USER_A, task.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Not eligible');
    });

    it('rejects a task that is no longer available', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const task = await seedTask({ title: 'Taken', status: 'available', created_by: 'seed' });

      const first = await takeTask(USER_A, task.id);
      expect(first.success).toBe(true);

      const second = await takeTask(USER_B, task.id);
      expect(second.success).toBe(false);
      expect(second.message).toBe('Task is no longer available');
    });

    it('yields exactly one winner under concurrent claims', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const task = await seedTask({ title: 'Race', status: 'available', created_by: 'seed' });

      const [r1, r2] = await Promise.allSettled([
        takeTask(USER_A, task.id),
        takeTask(USER_B, task.id)
      ]);
      const winners = [r1, r2].filter(
        (r): r is PromiseFulfilledResult<{ success: boolean }> =>
          r.status === 'fulfilled' && r.value.success
      );
      expect(winners).toHaveLength(1);
    });

    it('rejects when the user is at the active task limit', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      for (let i = 0; i < MAX_ACTIVE_TASKS; i++) {
        await seedTask({
          title: `Active ${i}`,
          assigned_to: USER_A,
          status: 'assigned',
          created_by: 'seed'
        });
      }
      const poolTask = await seedTask({ title: 'Pool', status: 'available', created_by: 'seed' });

      const res = await takeTask(USER_A, poolTask.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Active task limit reached');
    });
  });

  describe('completeTask', () => {
    it('completes an in-progress task owned by the caller', async () => {
      await seedEmployee(USER_A);
      const task = await seedTask({ title: 'Doing', status: 'available', created_by: 'seed' });
      await takeTask(USER_A, task.id);

      const res = await completeTask(USER_A, task.id);
      expect(res.success).toBe(true);
      expect(res.task?.status).toBe('completed');

      const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
      expect(row!.status).toBe('completed');
      expect(row!.completed_at).not.toBeNull();
    });

    it('rejects completing a task not taken by the caller', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const task = await seedTask({ title: 'Doing', status: 'available', created_by: 'seed' });
      await takeTask(USER_B, task.id);

      const res = await completeTask(USER_A, task.id);
      expect(res.success).toBe(false);
    });
  });
});

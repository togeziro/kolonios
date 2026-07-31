import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { tasks, taskRequirements, employeeSkills } from './schema/tasks';
import { employees } from './schema/masterdata';
import { locations } from './schema/attendance';
import type {
  AvailableTaskFilters,
  AvailableTasksResponse,
  MyTasksResponse,
  TaskActionResponse,
  TaskDetailResponse
} from '@/features/tasks/api/types';

export const MAX_ACTIVE_TASKS = 3;

type TaskRow = typeof tasks.$inferSelect;
type RequirementRow = typeof taskRequirements.$inferSelect;

async function toTask(row: TaskRow, reqs: RequirementRow[]) {
  let location: { id: number; name: string } | null = null;
  if (row.location_id != null) {
    const [loc] = await db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(eq(locations.id, row.location_id))
      .limit(1);
    location = loc ?? null;
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    task_type: row.task_type,
    status: row.status,
    priority: row.priority,
    location,
    dueAt: row.due_at ? row.due_at.toISOString() : null,
    estimatedMinutes: row.estimated_minutes,
    requiredSkills: reqs.map((r) => r.skill).filter((s): s is string => s != null),
    assignedTo: row.assigned_to,
    takenBy: row.taken_by
  };
}

async function loadRequirements(taskId: number): Promise<RequirementRow[]> {
  return db.select().from(taskRequirements).where(eq(taskRequirements.task_id, taskId));
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
  return sql`(${tasks.assigned_to} = ${userId} OR ${tasks.taken_by} = ${userId})`;
}

export async function getMyTasks(userId: string): Promise<MyTasksResponse> {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(inArray(tasks.status, ['assigned', 'in_progress']), isMine(userId)))
      .orderBy(desc(tasks.created_at));

    const result = [];
    for (const row of rows) {
      result.push(await toTask(row, await loadRequirements(row.id)));
    }
    return { success: true, tasks: result };
  } catch (e) {
    mapDbError(e, 'tasks.getMyTasks');
  }
}

export async function getAvailableTasks(
  userId: string,
  filters: AvailableTaskFilters = {}
): Promise<AvailableTasksResponse> {
  try {
    const profile = await getEligibilityProfile(userId);

    const conditions = [eq(tasks.status, 'available')];
    if (filters.locationId != null) conditions.push(eq(tasks.location_id, filters.locationId));
    if (filters.priority != null) conditions.push(eq(tasks.priority, filters.priority));
    const where = and(...conditions);

    const rows = await db.select().from(tasks).where(where).orderBy(desc(tasks.created_at));

    const eligible: AvailableTasksResponse['tasks'] = [];
    const unavailable: AvailableTasksResponse['unavailable'] = [];
    for (const row of rows) {
      const reqs = await loadRequirements(row.id);
      const task = await toTask(row, reqs);
      const reasons = unmetReasons(reqs, profile);
      if (reasons.length === 0) {
        eligible.push(task);
      } else {
        unavailable.push({ ...task, eligibilityReasons: reasons });
      }
    }
    return { success: true, tasks: eligible, unavailable };
  } catch (e) {
    mapDbError(e, 'tasks.getAvailableTasks');
  }
}

export async function getTaskDetail(userId: string, taskId: number): Promise<TaskDetailResponse> {
  try {
    const [row] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isMine(userId)))
      .limit(1);
    if (!row) return { success: false, message: 'Task not found' };
    return { success: true, task: await toTask(row, await loadRequirements(row.id)) };
  } catch (e) {
    mapDbError(e, 'tasks.getTaskDetail');
  }
}

export async function takeTask(userId: string, taskId: number): Promise<TaskActionResponse> {
  try {
    const result = await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.status, 'available')))
        .limit(1);
      if (!task) return { success: false, message: 'Task is no longer available' };

      const profile = await getEligibilityProfile(userId);
      const reqs = await loadRequirements(taskId);
      const reasons = unmetReasons(reqs, profile);
      if (reasons.length > 0) {
        return { success: false, message: `Not eligible: ${reasons.join(', ')}` };
      }

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(inArray(tasks.status, ['assigned', 'in_progress']), isMine(userId)));
      if (count >= MAX_ACTIVE_TASKS) {
        return { success: false, message: `Active task limit reached (${MAX_ACTIVE_TASKS})` };
      }

      const [claimed] = await tx
        .update(tasks)
        .set({
          status: 'in_progress',
          taken_by: userId,
          taken_at: new Date(),
          updated_at: new Date()
        })
        .where(and(eq(tasks.id, taskId), eq(tasks.status, 'available')))
        .returning();
      if (!claimed) return { success: false, message: 'Task is no longer available' };

      return { success: true, message: 'Task taken', task: await toTask(claimed, reqs) };
    });
    return result;
  } catch (e) {
    mapDbError(e, 'tasks.takeTask');
  }
}

export async function completeTask(userId: string, taskId: number): Promise<TaskActionResponse> {
  try {
    const [task] = await db
      .update(tasks)
      .set({ status: 'completed', completed_at: new Date(), updated_at: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.taken_by, userId), eq(tasks.status, 'in_progress')))
      .returning();
    if (!task) return { success: false, message: 'Task not found or not in progress by you' };
    return {
      success: true,
      message: 'Task completed',
      task: await toTask(task, await loadRequirements(task.id))
    };
  } catch (e) {
    mapDbError(e, 'tasks.completeTask');
  }
}

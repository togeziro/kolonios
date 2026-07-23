import { asc, eq } from 'drizzle-orm';
import { db } from './index';
import { DomainError, mapDbError } from '../errors';
import { kanbanColumns, kanbanTasks } from './schema/kanban';
import type { Task } from '@/features/kanban/api/types';

function toTask(row: typeof kanbanTasks.$inferSelect): Task {
  return {
    id: String(row.id),
    title: row.title,
    priority: row.priority,
    description: row.description ?? undefined,
    assignee: row.assignee ?? undefined,
    dueDate: row.due_date ?? undefined
  };
}

export async function getBoard(): Promise<Record<string, Task[]>> {
  try {
    const tasks = await db.select().from(kanbanTasks).orderBy(asc(kanbanTasks.position));

    const grouped: Record<string, Task[]> = {};
    for (const row of tasks) {
      const slug = row.column_slug;
      if (!grouped[slug]) grouped[slug] = [];
      grouped[slug].push(toTask(row));
    }

    const allColumns = await db
      .select({ slug: kanbanColumns.slug })
      .from(kanbanColumns)
      .orderBy(asc(kanbanColumns.position));

    for (const col of allColumns) {
      if (!grouped[col.slug]) grouped[col.slug] = [];
    }

    return grouped;
  } catch (e) {
    mapDbError(e, 'kanban.getBoard');
  }
}

export async function addTask(title: string, description?: string) {
  try {
    const tasks = await db
      .select({ position: kanbanTasks.position })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.column_slug, 'backlog'))
      .orderBy(asc(kanbanTasks.position));

    const nextPosition = tasks.length > 0 ? tasks[tasks.length - 1].position + 1 : 0;

    const [created] = await db
      .insert(kanbanTasks)
      .values({
        column_slug: 'backlog',
        title,
        priority: 'medium',
        description: description ?? null,
        assignee: null,
        due_date: null,
        position: nextPosition
      })
      .returning();

    if (!created) {
      throw new DomainError('Failed to create task');
    }

    return toTask(created);
  } catch (e) {
    mapDbError(e, 'kanban.addTask');
  }
}

export async function moveTask(taskId: number, columnSlug: string, position: number) {
  try {
    const existing = await db
      .select({ id: kanbanTasks.id, column_slug: kanbanTasks.column_slug })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.id, taskId));
    if (existing.length === 0) {
      throw new DomainError(`Task with id ${taskId} not found`);
    }

    const sourceSlug = existing[0].column_slug;

    const tasksInTarget = await db
      .select({ id: kanbanTasks.id, position: kanbanTasks.position })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.column_slug, columnSlug))
      .orderBy(asc(kanbanTasks.position));

    const withoutMoved = tasksInTarget.filter((t) => t.id !== taskId);
    const clampedPosition = Math.min(position, withoutMoved.length);

    await db.transaction(async (tx) => {
      await tx
        .update(kanbanTasks)
        .set({ column_slug: columnSlug, position: clampedPosition, updated_at: new Date() })
        .where(eq(kanbanTasks.id, taskId));

      for (let i = 0; i < withoutMoved.length; i++) {
        const newPos = i < clampedPosition ? i : i + 1;
        if (withoutMoved[i].position !== newPos) {
          await tx
            .update(kanbanTasks)
            .set({ position: newPos, updated_at: new Date() })
            .where(eq(kanbanTasks.id, withoutMoved[i].id));
        }
      }

      if (sourceSlug !== columnSlug) {
        const sourceTasks = await tx
          .select({ id: kanbanTasks.id, position: kanbanTasks.position })
          .from(kanbanTasks)
          .where(eq(kanbanTasks.column_slug, sourceSlug))
          .orderBy(asc(kanbanTasks.position));

        for (let i = 0; i < sourceTasks.length; i++) {
          if (sourceTasks[i].position !== i) {
            await tx
              .update(kanbanTasks)
              .set({ position: i, updated_at: new Date() })
              .where(eq(kanbanTasks.id, sourceTasks[i].id));
          }
        }
      }
    });

    return { success: true };
  } catch (e) {
    mapDbError(e, 'kanban.moveTask');
  }
}

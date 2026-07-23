import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getBoard, addTask, moveTask } from './kanban';
import { resetDatabase, seedKanban } from '@/test-utils/db';
import { db } from '@/lib/db';
import { kanbanTasks } from './schema/kanban';

async function tasksIn(slug: string) {
  const board = await getBoard();
  return (board[slug] ?? []).map((t) => t.title);
}

describe('kanban data access (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedKanban();
    await db.insert(kanbanTasks).values([
      { column_slug: 'backlog', title: 'T1', priority: 'high', position: 0 },
      { column_slug: 'backlog', title: 'T2', priority: 'medium', position: 1 },
      { column_slug: 'backlog', title: 'T3', priority: 'low', position: 2 }
    ]);
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it('returns a board keyed by every column, even empty ones', async () => {
    const board = await getBoard();
    expect(Object.keys(board).toSorted()).toEqual(['backlog', 'done', 'inProgress']);
    expect(board.backlog).toHaveLength(3);
    expect(board.done).toHaveLength(0);
  });

  it('keeps tasks ordered by position within a column', async () => {
    expect(await tasksIn('backlog')).toEqual(['T1', 'T2', 'T3']);
  });

  it('adds a new task to the end of the backlog', async () => {
    const task = await addTask('Fresh task', 'a description');
    expect(task.title).toBe('Fresh task');
    expect(task.priority).toBe('medium');
    expect(task.description).toBe('a description');

    const board = await getBoard();
    expect(board.backlog.map((t) => t.title)).toEqual(['T1', 'T2', 'T3', 'Fresh task']);
  });

  it('moves a task to an empty column at the given position', async () => {
    const [t1] = await db.select().from(kanbanTasks).where(eqTitle('T1'));
    await moveTask(t1.id, 'inProgress', 0);

    expect(await tasksIn('inProgress')).toEqual(['T1']);
    expect(await tasksIn('backlog')).toEqual(['T2', 'T3']);
  });

  it('inserts a moved task at the correct index in the target column', async () => {
    const [t3] = await db.select().from(kanbanTasks).where(eqTitle('T3'));
    // Move T3 into inProgress, before the (empty) column -> position 0 there.
    await db.insert(kanbanTasks).values({
      column_slug: 'inProgress',
      title: 'A',
      priority: 'low',
      position: 0
    });
    await moveTask(t3.id, 'inProgress', 0);

    expect(await tasksIn('inProgress')).toEqual(['T3', 'A']);
    expect(await tasksIn('backlog')).toEqual(['T1', 'T2']);
  });

  it('reorders within the same column', async () => {
    const [t3] = await db.select().from(kanbanTasks).where(eqTitle('T3'));
    await moveTask(t3.id, 'backlog', 0);
    expect(await tasksIn('backlog')).toEqual(['T3', 'T1', 'T2']);
  });

  it('clamps an out-of-range position to the column end', async () => {
    const [t1] = await db.select().from(kanbanTasks).where(eqTitle('T1'));
    await db.insert(kanbanTasks).values({
      column_slug: 'done',
      title: 'Z',
      priority: 'low',
      position: 0
    });
    await moveTask(t1.id, 'done', 99);
    expect(await tasksIn('done')).toEqual(['Z', 'T1']);
  });

  it('throws when moving a non-existent task', async () => {
    await expect(moveTask(999_999, 'done', 0)).rejects.toThrow(/not found/i);
  });
});

function eqTitle(title: string) {
  return eq(kanbanTasks.title, title);
}

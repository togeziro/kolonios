import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { kanbanColumns, kanbanTasks, kanbanPriorityEnum } from './kanban';

describe('kanban schema', () => {
  it('defines the priority enum', () => {
    expect(kanbanPriorityEnum.enumValues).toEqual(['low', 'medium', 'high']);
  });

  it('gives each column a unique slug and ordering position', () => {
    expect(kanbanColumns.slug.notNull).toBe(true);
    expect(kanbanColumns.slug.isUnique).toBe(true);
    expect(kanbanColumns.position.notNull).toBe(true);
  });

  it('requires a task title and priority', () => {
    expect(kanbanTasks.title.notNull).toBe(true);
    expect(kanbanTasks.priority.notNull).toBe(true);
  });

  it('references the column slug for grouping', () => {
    expect(kanbanTasks.column_slug.notNull).toBe(true);

    const fks = getTableConfig(kanbanTasks).foreignKeys;
    expect(fks.length).toBeGreaterThan(0);

    const ref = fks[0].reference();
    expect(ref.columns.map((c) => c.name)).toContain('column_slug');
    expect(getTableConfig(ref.foreignTable).name).toBe('kanban_columns');
    expect(ref.foreignColumns.map((c) => c.name)).toContain('slug');
  });

  it('keeps nullable task metadata', () => {
    expect(kanbanTasks.description.notNull).toBe(false);
    expect(kanbanTasks.assignee.notNull).toBe(false);
    expect(kanbanTasks.due_date.notNull).toBe(false);
  });
});

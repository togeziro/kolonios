import { pgEnum, pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const kanbanPriorityEnum = pgEnum('kanban_priority', ['low', 'medium', 'high']);

export const kanbanColumns = pgTable('kanban_columns', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const kanbanTasks = pgTable('kanban_tasks', {
  id: serial('id').primaryKey(),
  column_slug: text('column_slug')
    .notNull()
    .references(() => kanbanColumns.slug),
  title: text('title').notNull(),
  priority: kanbanPriorityEnum('priority').notNull(),
  description: text('description'),
  assignee: text('assignee'),
  due_date: text('due_date'),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type KanbanTask = typeof kanbanTasks.$inferSelect;
export type NewKanbanTask = typeof kanbanTasks.$inferInsert;

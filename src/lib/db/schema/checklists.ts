import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';
import { shifts } from './attendance';

export const dailyChecklistStatusEnum = pgEnum('daily_checklist_status', [
  'draft',
  'submitted',
  'approved',
  'rejected'
]);

export const checklistItemOutcomeEnum = pgEnum('checklist_item_outcome', [
  'ok',
  'issue',
  'pending'
]);

export const dailyChecklists = pgTable(
  'daily_checklists',
  {
    id: serial('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    checklist_date: text('checklist_date').notNull(), // YYYY-MM-DD, business timezone
    shift_id: integer('shift_id').references(() => shifts.id, { onDelete: 'set null' }),
    shift_name: text('shift_name').notNull().default(''),
    shift_start_time: text('shift_start_time').notNull().default(''), // HH:MM snapshot
    shift_end_time: text('shift_end_time').notNull().default(''), // HH:MM snapshot
    status: dailyChecklistStatusEnum('status').notNull().default('draft'),
    started_at: timestamp('started_at'),
    ended_at: timestamp('ended_at'),
    global_note: text('global_note').notNull().default(''),
    reviewer_id: text('reviewer_id').references(() => user.id, { onDelete: 'set null' }),
    review_note: text('review_note').notNull().default(''),
    reviewed_at: timestamp('reviewed_at'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (t) => [uniqueIndex('daily_checklists_user_date_unique').on(t.user_id, t.checklist_date)]
);

export const dailyChecklistItems = pgTable(
  'daily_checklist_items',
  {
    id: serial('id').primaryKey(),
    checklist_id: integer('checklist_id')
      .notNull()
      .references(() => dailyChecklists.id, { onDelete: 'cascade' }),
    item_key: text('item_key').notNull(),
    outcome: checklistItemOutcomeEnum('outcome').notNull().default('pending'),
    note: text('note').notNull().default(''),
    photo_key: text('photo_key').notNull().default(''),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (t) => [uniqueIndex('daily_checklist_items_checklist_item_unique').on(t.checklist_id, t.item_key)]
);

export const dailyChecklistRelations = relations(dailyChecklists, ({ one, many }) => ({
  user: one(user, {
    fields: [dailyChecklists.user_id],
    references: [user.id]
  }),
  reviewer: one(user, {
    fields: [dailyChecklists.reviewer_id],
    references: [user.id]
  }),
  shift: one(shifts, {
    fields: [dailyChecklists.shift_id],
    references: [shifts.id]
  }),
  items: many(dailyChecklistItems)
}));

export const dailyChecklistItemRelations = relations(dailyChecklistItems, ({ one }) => ({
  checklist: one(dailyChecklists, {
    fields: [dailyChecklistItems.checklist_id],
    references: [dailyChecklists.id]
  })
}));

export type DailyChecklistStatus = (typeof dailyChecklistStatusEnum.enumValues)[number];
export type ChecklistItemOutcome = (typeof checklistItemOutcomeEnum.enumValues)[number];
export type DailyChecklist = typeof dailyChecklists.$inferSelect;
export type NewDailyChecklist = typeof dailyChecklists.$inferInsert;
export type DailyChecklistItem = typeof dailyChecklistItems.$inferSelect;
export type NewDailyChecklistItem = typeof dailyChecklistItems.$inferInsert;

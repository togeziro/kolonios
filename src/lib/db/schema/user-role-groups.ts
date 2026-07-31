import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth-schema';
import { roleGroups } from './role-groups';

export const userRoleGroups = pgTable('user_role_groups', {
  user_id: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  role_group_id: text('role_group_id')
    .notNull()
    .references(() => roleGroups.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow().notNull()
});

export type UserRoleGroup = typeof userRoleGroups.$inferSelect;
export type NewUserRoleGroup = typeof userRoleGroups.$inferInsert;

import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export type ModulePermissions = Record<string, boolean>;

export type Permissions = Record<string, ModulePermissions>;

export const roleGroups = pgTable('role_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  permissions: jsonb('permissions').$type<Permissions>().notNull().default({}),
  is_admin: boolean('is_admin').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export type RoleGroup = typeof roleGroups.$inferSelect;
export type NewRoleGroup = typeof roleGroups.$inferInsert;

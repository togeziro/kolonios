import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth-schema';

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actorUserId: text('actor_user_id')
    .notNull()
    .references(() => user.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  requestId: text('request_id'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;

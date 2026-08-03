import { and, desc, eq, like, sql } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { auditLog } from './schema/audit-log';
import { buildPagination } from './utils';

export type AuditEntryRow = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
};

export async function insertAuditRow(entry: AuditEntryRow) {
  try {
    await db.insert(auditLog).values({
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before === undefined ? null : (entry.before as never),
      after: entry.after === undefined ? null : (entry.after as never),
      requestId: entry.requestId ?? null
    });
  } catch (e) {
    // The audit trail must never break the business operation it records.
    const { logger } = await import('@/lib/logger');
    logger.error({ err: e, action: entry.action }, 'audit.insert-failed');
  }
}

export type AuditFilters = {
  page?: number;
  perPage?: number;
  action?: string;
  entityType?: string;
};

export type AuditLogResponse = {
  total: number;
  rows: (typeof auditLog.$inferSelect)[];
};

export async function getAuditLog(filters: AuditFilters = {}): Promise<AuditLogResponse> {
  try {
    const { page, limit, offset } = buildPagination({ page: filters.page, limit: filters.perPage });
    const where = and(
      filters.action ? like(auditLog.action, `%${filters.action}%`) : undefined,
      filters.entityType ? eq(auditLog.entityType, filters.entityType) : undefined
    );
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where);
    const rows = await db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);
    return { total: countRow?.count ?? 0, rows };
  } catch (e) {
    mapDbError(e, 'audit.getAuditLog');
  }
}

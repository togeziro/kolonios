import { getRequestId } from './request-id';
import { insertAuditRow } from './db/audit';

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | number;
  before?: unknown;
  after?: unknown;
};

export async function withAudit<T>(
  actorUserId: string,
  entry: AuditEntry,
  fn: () => Promise<T>
): Promise<T> {
  const result = await fn();
  await insertAuditRow({
    actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId != null ? String(entry.entityId) : null,
    before: entry.before,
    after: entry.after,
    requestId: getRequestId() ?? null
  });
  return result;
}

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requirePermission } from '@/lib/auth/session';
import { withRequestContext } from '@/lib/request-id';

const auditFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().max(100).optional().default(50),
  action: z.string().optional()
});

export type AuditLogListItem = {
  id: number;
  createdAt: Date;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
};

export type AuditLogListResponse = {
  total: number;
  rows: AuditLogListItem[];
};

export const getAuditLogFn = createServerFn({ method: 'GET' })
  .validator(zodValidator(auditFiltersSchema))
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      await requirePermission('audit_log', 'view');
      const { getAuditLog } = await import('@/lib/db/audit');
      const result = await getAuditLog(data);
      return {
        total: result.total,
        rows: result.rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          actorUserId: row.actorUserId,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId
        }))
      } satisfies AuditLogListResponse;
    })
  );

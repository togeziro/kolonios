import { queryOptions } from '@tanstack/react-query';
import { getAuditLogFn } from './service';
import type { AuditFilters } from '@/lib/db/audit';

export const auditKeys = {
  all: ['audit-log'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, filters] as const
};

export const auditLogQueryOptions = (filters: AuditFilters = {}) =>
  queryOptions({
    queryKey: auditKeys.list(filters),
    queryFn: () => getAuditLogFn({ data: filters }),
    staleTime: 30_000
  });

import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getAuditLogFn: vi.fn()
}));

import { auditKeys } from './queries';
import { auditLogQueryOptions } from './queries';
import { getAuditLogFn } from './service';

describe('auditKeys', () => {
  it('shapes query keys', () => {
    expect(auditKeys.all).toEqual(['audit-log']);
    const filters = { action: 'create' };
    expect(auditKeys.list(filters)).toEqual(['audit-log', filters]);
  });
});

describe('auditLogQueryOptions', () => {
  it('defaults to empty filters', () => {
    const options = auditLogQueryOptions();
    expect(options.queryKey).toEqual(['audit-log', {}]);
    expect(options.staleTime).toBe(30_000);
    options.queryFn!(undefined as never);
    expect(getAuditLogFn).toHaveBeenCalledWith({ data: {} });
  });

  it('passes filters through', () => {
    const filters = { action: 'create' };
    const options = auditLogQueryOptions(filters);
    expect(options.queryKey).toEqual(['audit-log', filters]);
    options.queryFn!(undefined as never);
    expect(getAuditLogFn).toHaveBeenCalledWith({ data: filters });
  });
});

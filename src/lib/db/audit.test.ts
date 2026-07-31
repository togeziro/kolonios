import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetAllTables, seedUser } from '@/test-utils/db';
import { db } from './index';
import { auditLog } from './schema/audit-log';
import { getAuditLog, insertAuditRow } from './audit';

describe('audit data access', () => {
  beforeAll(async () => {
    await resetAllTables();
    await seedUser('actor-1', { role: 'admin' });
  });

  beforeEach(async () => {
    await db.delete(auditLog);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('inserts an audit row and lists it back', async () => {
    await insertAuditRow({
      actorUserId: 'actor-1',
      action: 'employee.create',
      entityType: 'employee',
      entityId: 'emp-1',
      before: null,
      after: { name: 'New Employee' },
      requestId: 'req-123'
    });

    const { total, rows } = await getAuditLog({});
    expect(total).toBe(1);
    expect(rows[0].action).toBe('employee.create');
    expect(rows[0].actorUserId).toBe('actor-1');
    expect(rows[0].requestId).toBe('req-123');
    expect(rows[0].after).toEqual({ name: 'New Employee' });
  });

  it('filters by action substring', async () => {
    await insertAuditRow({ actorUserId: 'actor-1', action: 'user.update', entityType: 'user' });
    await insertAuditRow({
      actorUserId: 'actor-1',
      action: 'department.delete',
      entityType: 'department'
    });

    const { total } = await getAuditLog({ action: 'user' });
    expect(total).toBe(1);
  });

  it('paginates results', async () => {
    for (let i = 0; i < 3; i++) {
      await insertAuditRow({ actorUserId: 'actor-1', action: `a.${i}`, entityType: 'x' });
    }
    const { total, rows } = await getAuditLog({ page: 1, perPage: 2 });
    expect(total).toBe(3);
    expect(rows).toHaveLength(2);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetAllTables, seedUser } from '@/test-utils/db';
import { db } from './index';
import { auditLog } from './schema/audit-log';
import { getUserForAudit } from './users';
import { withAudit } from '@/lib/audit';

describe('user audit wiring', () => {
  beforeAll(async () => {
    await resetAllTables();
    await seedUser('audit-admin', { role: 'admin' });
    await seedUser('target-user', { role: 'employee' });
  });

  beforeEach(async () => {
    await db.delete(auditLog);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('records before/after snapshots for a user update', async () => {
    const before = await getUserForAudit('target-user');

    const result = await withAudit(
      'audit-admin',
      {
        action: 'user.update',
        entityType: 'user',
        entityId: 'target-user',
        before,
        after: { ...before, role: 'hr' }
      },
      async () => ({ ok: true })
    );

    expect(result).toEqual({ ok: true });

    const [row] = await db.select().from(auditLog);
    expect(row.actorUserId).toBe('audit-admin');
    expect(row.action).toBe('user.update');
    expect(row.entityId).toBe('target-user');
    expect(row.before).toMatchObject({ id: 'target-user', role: 'employee' });
    expect(row.after).toMatchObject({ id: 'target-user', role: 'hr' });
  });

  it('records a create with before=null', async () => {
    await withAudit(
      'audit-admin',
      {
        action: 'user.create',
        entityType: 'user',
        entityId: 'new-user',
        before: null,
        after: { id: 'new-user', role: 'employee' }
      },
      async () => ({})
    );

    const [row] = await db.select().from(auditLog);
    expect(row.action).toBe('user.create');
    expect(row.before).toBeNull();
    expect(row.after).toMatchObject({ id: 'new-user' });
  });
});

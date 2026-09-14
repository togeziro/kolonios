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

  it('never stores a password in the audit trail', async () => {
    await withAudit(
      'audit-admin',
      {
        action: 'user.set_password',
        entityType: 'user',
        entityId: 'target-user',
        before: null,
        after: null
      },
      async () => ({})
    );

    const [row] = await db.select().from(auditLog);
    expect(row.action).toBe('user.set_password');
    // before/after carry no secret: the password itself must never be audited.
    expect(row.before).toBeNull();
    expect(row.after).toBeNull();
  });

  it('strips a generated one-time password before auditing user.create', async () => {
    // Mirrors service.ts: the create response carries generatedPassword once
    // for the admin's copy dialog — the audit snapshot must exclude it.
    const created = {
      success: true as const,
      message: 'User created successfully',
      user: {
        id: 'new-user',
        name: 'New User',
        email: 'new@test.com',
        status: 'Active',
        role: 'employee',
        role_group_id: 'rg-1',
        role_group_name: 'Employee',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      generatedPassword: 't3mp!!passw0rd'
    };
    const { generatedPassword: _secret, ...auditable } = created;
    await withAudit(
      'audit-admin',
      {
        action: 'user.create',
        entityType: 'user',
        entityId: created.user.id,
        before: null,
        after: auditable
      },
      async () => ({})
    );

    const [row] = await db.select().from(auditLog);
    expect(row.action).toBe('user.create');
    expect(JSON.stringify(row.after)).not.toContain('t3mp!!passw0rd');
    expect(row.after).toMatchObject({ user: { id: 'new-user' } });
  });
});

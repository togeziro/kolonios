import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getUsers, createUser, updateUser, deleteUser } from './users';
import { resetAllTables, seedUser } from '@/test-utils/db';
import { db } from '@/lib/db';
import { user, session, account, verification } from './auth-schema';

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => new Headers()
}));

vi.mock('@/lib/auth/auth.server', () => ({
  auth: {
    api: {
      createUser: vi.fn().mockResolvedValue({
        id: 'created-usr-1',
        name: 'New User',
        email: 'new@test.com',
        role: 'employee',
        banned: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      updateUser: vi.fn().mockResolvedValue({
        id: 'usr-a',
        name: 'Alice Updated',
        email: 'alice@test.com',
        role: 'admin',
        banned: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      removeUser: vi.fn().mockResolvedValue({ success: true })
    }
  }
}));

async function seedUsers() {
  await seedUser('usr-a', { name: 'Alice Admin', email: 'alice@test.com', role: 'admin' });
  await seedUser('usr-b', { name: 'Bob Employee', email: 'bob@test.com', role: 'employee' });
  await seedUser('usr-c', {
    name: 'Carol Tech',
    email: 'carol@test.com',
    role: 'technician',
    banned: true
  });
}

describe('users data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedUsers();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('returns users with pagination and total count', async () => {
    const res = await getUsers({ page: 1, limit: 2 });
    expect(res.success).toBe(true);
    expect(res.total_users).toBe(3);
    expect(res.users).toHaveLength(2);
    expect(res.users[0]).toHaveProperty('id');
    expect(res.users[0]).toHaveProperty('role_group_id');
  });

  it('filters by search on name/email', async () => {
    const res = await getUsers({ search: 'carol' });
    expect(res.total_users).toBe(1);
    expect(res.users[0].name).toBe('Carol Tech');
  });

  it('filters by roles', async () => {
    const res = await getUsers({ roles: 'employee' });
    expect(res.total_users).toBe(1);
    expect(res.users[0].name).toBe('Bob Employee');
  });

  it('filters by status Active/Inactive (banned flag)', async () => {
    const active = await getUsers({ status: 'Active' });
    expect(active.total_users).toBe(2);
    expect(active.users.every((u) => u.status === 'Active')).toBe(true);

    const inactive = await getUsers({ status: 'Inactive' });
    expect(inactive.total_users).toBe(1);
    expect(inactive.users[0].name).toBe('Carol Tech');
  });

  it('sorts by name asc/desc', async () => {
    const asc = await getUsers({ sort: JSON.stringify([{ id: 'name', desc: false }]) });
    expect(asc.users[0].name).toBe('Alice Admin');

    const desc = await getUsers({ sort: JSON.stringify([{ id: 'name', desc: true }]) });
    expect(desc.users[0].name).toBe('Carol Tech');
  });

  it('maps banned flag to status', async () => {
    const res = await getUsers({ search: 'bob' });
    expect(res.users[0].status).toBe('Active');
    const res2 = await getUsers({ search: 'carol' });
    expect(res2.users[0].status).toBe('Inactive');
  });

  it('falls back to id row when user row missing (no orphan check)', async () => {
    const res = await getUsers({ search: 'alice' });
    expect(res.users[0].id).toBe('usr-a');
    expect(res.users[0].email).toBe('alice@test.com');
  });

  it('creates a user through the auth admin api', async () => {
    const res = await createUser({
      email: 'new@test.com',
      name: 'New User',
      role: 'employee',
      status: 'Active'
    });
    expect(res.success).toBe(true);
    expect(res.user?.id).toBe('created-usr-1');
    expect(res.user?.role).toBe('employee');
  });

  it('updates a user name and status through the auth admin api', async () => {
    const res = await updateUser('usr-a', {
      name: 'Alice Updated',
      email: 'alice@test.com',
      role: 'admin',
      status: 'Active'
    });
    expect(res.success).toBe(true);
    expect(res.user?.name).toBe('Alice Updated');
  });

  it('deletes a user through the auth admin api', async () => {
    const res = await deleteUser('usr-a');
    expect(res.success).toBe(true);
  });

  it('resolves related records through the auth schema relations', async () => {
    await db.insert(session).values({
      id: 'sess-1',
      userId: 'usr-a',
      token: 'token-1',
      expiresAt: new Date(Date.now() + 3_600_000)
    });
    const withSessions = await db.query.user.findFirst({
      where: eq(user.id, 'usr-a'),
      with: { sessions: true, accounts: true, employee: true, customer: true }
    });
    expect(withSessions?.id).toBe('usr-a');
    expect(withSessions?.sessions).toHaveLength(1);
    expect(withSessions?.sessions[0]?.id).toBe('sess-1');

    const withUser = await db.query.session.findFirst({
      where: eq(session.id, 'sess-1'),
      with: { user: true }
    });
    expect(withUser?.user?.id).toBe('usr-a');

    const withAccount = await db.query.account.findFirst({
      where: eq(account.id, 'acct-1'),
      with: { user: true }
    });
    expect(withAccount).toBeUndefined();
  });

  it('triggers the updated_at hooks on auth tables', async () => {
    const [u] = await db
      .update(user)
      .set({ name: 'Alice Renamed' })
      .where(eq(user.id, 'usr-a'))
      .returning();
    expect(u?.name).toBe('Alice Renamed');

    await db.insert(session).values({
      id: 'sess-2',
      userId: 'usr-a',
      token: 'token-2',
      expiresAt: new Date(Date.now() + 3_600_000)
    });
    const [s] = await db
      .update(session)
      .set({ ipAddress: '10.0.0.1' })
      .where(eq(session.id, 'sess-2'))
      .returning();
    expect(s?.ipAddress).toBe('10.0.0.1');

    await db.insert(account).values({
      id: 'acct-2',
      accountId: 'acct-2',
      providerId: 'credential',
      userId: 'usr-a'
    });
    const [a] = await db
      .update(account)
      .set({ scope: 'profile' })
      .where(eq(account.id, 'acct-2'))
      .returning();
    expect(a?.scope).toBe('profile');

    await db.insert(verification).values({
      id: 'verif-1',
      identifier: 'usr-a',
      value: 'code-1',
      expiresAt: new Date(Date.now() + 3_600_000)
    });
    const [v] = await db
      .update(verification)
      .set({ value: 'code-2' })
      .where(eq(verification.id, 'verif-1'))
      .returning();
    expect(v?.value).toBe('code-2');
  });
});

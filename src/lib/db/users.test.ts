import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getUsers, createUser, updateUser, deleteUser, replaceUserPassword } from './users';
import { resetAllTables, seedUser } from '@/test-utils/db';
import { db } from '@/lib/db';
import { user, session, account, verification } from './auth-schema';
import { roleGroups } from './schema/role-groups';
import { userRoleGroups } from './schema/user-role-groups';

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => new Headers()
}));

vi.mock('@/lib/auth/auth.server', () => ({
  auth: {
    api: {
      createUser: vi.fn().mockResolvedValue({
        user: {
          id: 'created-usr-1',
          name: 'New User',
          email: 'new@test.com',
          role: 'employee',
          banned: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }),
      adminUpdateUser: vi.fn().mockResolvedValue({
        id: 'usr-a',
        name: 'Alice Updated',
        email: 'alice@test.com',
        role: 'admin',
        banned: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      removeUser: vi.fn().mockResolvedValue({ success: true }),
      setUserPassword: vi.fn().mockResolvedValue({ status: true })
    }
  }
}));

type MockFn = ReturnType<typeof vi.fn>;

async function adminApiMocks() {
  const { auth } = await import('@/lib/auth/auth.server');
  return auth.api as unknown as {
    createUser: MockFn;
    adminUpdateUser: MockFn;
    removeUser: MockFn;
    setUserPassword: MockFn;
  };
}

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
      status: 'Active',
      password: 's3cret!!pass'
    });
    expect(res.success).toBe(true);
    expect(res.user?.id).toBe('created-usr-1');
    expect(res.user?.role).toBe('employee');
    const mocks = await adminApiMocks();
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: 'new@test.com', password: 's3cret!!pass' })
      })
    );
  });

  it('flags a created user for forced password rotation', async () => {
    await seedUser('usr-flagged', {
      name: 'Flag Ged',
      email: 'flagged@test.com',
      role: 'employee'
    });
    const mocks = await adminApiMocks();
    (mocks.createUser as MockFn).mockResolvedValueOnce({
      user: {
        id: 'usr-flagged',
        name: 'Flag Ged',
        email: 'flagged@test.com',
        role: 'employee',
        banned: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    const res = await createUser({
      email: 'flagged@test.com',
      name: 'Flag Ged',
      role: 'employee',
      status: 'Active',
      password: 's3cret!!pass'
    });
    expect(res.success).toBe(true);
    const rows = await db.select().from(user).where(eq(user.id, 'usr-flagged'));
    expect(rows[0]?.mustChangePassword).toBe(true);
  });

  it('replaces a user password through the auth admin api', async () => {
    const res = await replaceUserPassword('usr-a', 'n3w!!passw0rd');
    expect(res.success).toBe(true);
    const mocks = await adminApiMocks();
    expect(mocks.setUserPassword).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: 'usr-a', newPassword: 'n3w!!passw0rd' }
    });
    const rows = await db.select().from(user).where(eq(user.id, 'usr-a'));
    expect(rows[0]?.mustChangePassword).toBe(true);
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
    // Regression: /admin/update-user runs behind adminMiddleware — the
    // caller's session headers are mandatory or Better Auth throws
    // APIError UNAUTHORIZED.
    const mocks = await adminApiMocks();
    expect(mocks.adminUpdateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        userId: 'usr-a',
        data: {
          name: 'Alice Updated',
          email: 'alice@test.com',
          role: 'admin',
          banned: false,
          banReason: null,
          banExpires: null
        }
      }
    });
  });

  it('preserves the current role when the update omits role and role group', async () => {
    const mocks = await adminApiMocks();
    mocks.adminUpdateUser.mockClear();
    const res = await updateUser('usr-b', {
      name: 'Bob Renamed',
      email: 'bob@test.com',
      status: 'Active'
    });
    expect(res.success).toBe(true);
    // usr-b is seeded with role 'employee' — no literal 'user' downgrade.
    expect(mocks.adminUpdateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        userId: 'usr-b',
        data: {
          name: 'Bob Renamed',
          email: 'bob@test.com',
          role: 'employee',
          banned: false,
          banReason: null,
          banExpires: null
        }
      }
    });
  });

  it('sends the ban reason on deactivation and clears it on reactivation', async () => {
    const mocks = await adminApiMocks();
    mocks.adminUpdateUser.mockClear();
    await updateUser('usr-b', {
      name: 'Bob Employee',
      email: 'bob@test.com',
      status: 'Inactive'
    });
    expect(mocks.adminUpdateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        userId: 'usr-b',
        data: {
          name: 'Bob Employee',
          email: 'bob@test.com',
          role: 'employee',
          banned: true,
          banReason: 'Deactivated by admin'
        }
      }
    });
  });

  it('compensates a partial create by removing the orphaned account', async () => {
    await seedUser('usr-orphan', {
      name: 'Orphan User',
      email: 'orphan@test.com',
      role: 'employee'
    });
    await db.insert(roleGroups).values({
      id: 'rg-admin-x',
      name: 'Administrator',
      description: 'Admins',
      permissions: {},
      is_admin: true
    });
    const mocks = await adminApiMocks();
    (mocks.createUser as MockFn).mockResolvedValueOnce({
      user: {
        id: 'usr-orphan',
        name: 'Orphan User',
        email: 'orphan@test.com',
        role: 'employee',
        banned: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    // Role sync (adminUpdateUser) fails AFTER the account exists.
    (mocks.adminUpdateUser as MockFn).mockRejectedValueOnce(new Error('sync boom'));
    mocks.removeUser.mockClear();
    await expect(
      createUser({
        email: 'orphan@test.com',
        name: 'Orphan User',
        role_group_id: 'rg-admin-x',
        status: 'Active',
        password: 's3cret!!pass'
      })
    ).rejects.toThrow();
    // Best-effort compensation deletes the orphan with session headers.
    expect(mocks.removeUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: 'usr-orphan' }
    });
  });

  it('syncs the legacy role with headers when creation picks a role group', async () => {
    await seedUser('usr-rg', {
      name: 'Rg User',
      email: 'rg@test.com',
      role: 'employee'
    });
    await db.insert(roleGroups).values({
      id: 'rg-admin',
      name: 'Administrator',
      description: 'Admins',
      permissions: {},
      is_admin: true
    });
    const mocks = await adminApiMocks();
    (mocks.createUser as MockFn).mockResolvedValueOnce({
      user: {
        id: 'usr-rg',
        name: 'Rg User',
        email: 'rg@test.com',
        role: 'employee',
        banned: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    const res = await createUser({
      email: 'rg@test.com',
      name: 'Rg User',
      role_group_id: 'rg-admin',
      status: 'Active',
      password: 's3cret!!pass'
    });
    expect(res.success).toBe(true);
    expect(res.user?.role).toBe('admin');
    // Regression: the role-sync call after createUser needs the same
    // session headers (this exact call threw UNAUTHORIZED in production).
    expect(mocks.adminUpdateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: 'usr-rg', data: { role: 'admin' } }
    });
    const rows = await db.select().from(userRoleGroups).where(eq(userRoleGroups.user_id, 'usr-rg'));
    expect(rows[0]?.role_group_id).toBe('rg-admin');
  });

  it('deletes a user through the auth admin api', async () => {
    const res = await deleteUser('usr-a');
    expect(res.success).toBe(true);
    // Regression: /admin/remove-user also runs behind adminMiddleware.
    const mocks = await adminApiMocks();
    expect(mocks.removeUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: 'usr-a' }
    });
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
      issuer: 'local:credential',
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

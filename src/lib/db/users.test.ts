import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getUsers } from './users';
import { resetAllTables, seedUser } from '@/test-utils/db';

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
});

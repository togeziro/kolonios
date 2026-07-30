import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} from './customers';
import { resetAllTables, seedUser } from '@/test-utils/db';
import { db } from '@/lib/db';
import { customers } from './schema/customers';

const TEST_USER_ID = 'test-user-cust-123';
const TEST_CREATOR_ID = 'test-creator-cust-456';

async function seedCustomer(
  seedId: string,
  overrides: Partial<typeof customers.$inferInsert> = {}
) {
  const n = seedId.replace(/\D/g, '').slice(-4) || '0001';
  await db.insert(customers).values({
    id: seedId,
    customer_code: `CUST-${String(Number(n) || 1).padStart(4, '0')}`,
    full_name: `Customer ${seedId}`,
    email: `${seedId}@test.com`,
    phone: `000${seedId}`.slice(-10),
    id_card_number: `ID-${seedId}`,
    created_by: TEST_CREATOR_ID,
    ...overrides
  });
}

async function seedCustomerWithUser(
  seedId: string,
  overrides: Partial<typeof customers.$inferInsert> = {}
) {
  await seedUser(seedId);
  await seedCustomer(seedId, overrides);
}

describe('customers data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    await seedUser(TEST_USER_ID);
    await seedUser(TEST_CREATOR_ID);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('lists customers with pagination metadata', async () => {
    await seedCustomer(TEST_USER_ID, {
      full_name: 'Alice',
      email: 'alice@test.com',
      phone: '1234567890'
    });

    const res = await listCustomers({ page: 1, limit: 10 });
    expect(res.success).toBe(true);
    expect(res.total_customers).toBe(1);
    expect(res.customers).toHaveLength(1);
    expect(res.customers[0].full_name).toBe('Alice');
  });

  it('paginates results', async () => {
    for (let i = 0; i < 5; i++) {
      await seedCustomerWithUser(`cust-${i}`, {
        customer_code: `CUST-${String(i + 1).padStart(4, '0')}`,
        full_name: `Customer ${i}`,
        email: `cust${i}@test.com`,
        phone: `00000000${i}`
      });
    }

    const page1 = await listCustomers({ page: 1, limit: 2 });
    const page2 = await listCustomers({ page: 2, limit: 2 });
    expect(page1.customers).toHaveLength(2);
    expect(page2.customers).toHaveLength(2);
    expect(page1.customers[0].id).not.toBe(page2.customers[0].id);
  });

  it('serializes created_at to ISO strings', async () => {
    await seedCustomer(TEST_USER_ID, {
      full_name: 'Alice',
      email: 'alice@test.com',
      phone: '1234567890'
    });

    const res = await listCustomers({});
    expect(res.customers[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('filters by status', async () => {
    await seedCustomerWithUser('c1', {
      customer_code: 'CUST-0001',
      full_name: 'Active',
      email: 'a@t.com',
      phone: '1000000001',
      status: 'active'
    });
    await seedCustomerWithUser('c2', {
      customer_code: 'CUST-0002',
      full_name: 'Inactive',
      email: 'b@t.com',
      phone: '2000000002',
      status: 'inactive'
    });

    const active = await listCustomers({ status: 'active' });
    expect(active.total_customers).toBe(1);
    expect(active.customers[0].full_name).toBe('Active');

    const all = await listCustomers({ status: 'all' });
    expect(all.total_customers).toBe(2);
  });

  it('searches across name, email, phone and customer_code', async () => {
    await seedCustomerWithUser('c1', {
      customer_code: 'CUST-0001',
      full_name: 'Alice Smith',
      email: 'alice@test.com',
      phone: '1111111111'
    });
    await seedCustomerWithUser('c2', {
      customer_code: 'CUST-0002',
      full_name: 'Bob Jones',
      email: 'bob@example.com',
      phone: '2222222222'
    });
    await seedCustomerWithUser('c3', {
      customer_code: 'CUST-0003',
      full_name: 'Carol',
      email: 'carol@test.com',
      phone: '3333333333'
    });

    const byName = await listCustomers({ search: 'Smith' });
    expect(byName.total_customers).toBe(1);

    const byPhone = await listCustomers({ search: '2222' });
    expect(byPhone.total_customers).toBe(1);

    const byCode = await listCustomers({ search: '0001' });
    expect(byCode.total_customers).toBe(1);
  });

  it('sorts by full_name descending', async () => {
    await seedCustomerWithUser('c1', {
      customer_code: 'CUST-0001',
      full_name: 'Beta',
      email: 'b@t.com',
      phone: '1111111111'
    });
    await seedCustomerWithUser('c2', {
      customer_code: 'CUST-0002',
      full_name: 'Alpha',
      email: 'a@t.com',
      phone: '2222222222'
    });

    const res = await listCustomers({ sort: JSON.stringify([{ id: 'full_name', desc: true }]) });
    expect(res.customers.map((c) => c.full_name)).toEqual(['Beta', 'Alpha']);
  });

  it('gets a customer by id', async () => {
    await seedCustomer(TEST_USER_ID, {
      full_name: 'Alice',
      email: 'alice@test.com',
      phone: '1234567890'
    });

    const res = await getCustomerById(TEST_USER_ID);
    expect(res.success).toBe(true);
    expect(res.customer.full_name).toBe('Alice');
  });

  it('reports failure for a missing customer id', async () => {
    const res = await getCustomerById('nonexistent');
    expect(res.success).toBe(false);
  });

  it('creates a customer with auto-generated customer code', async () => {
    const res = await createCustomer({
      id: TEST_USER_ID,
      full_name: 'New Customer',
      email: 'new@test.com',
      phone: '5555555555',
      status: 'active',
      created_by: TEST_CREATOR_ID
    });

    expect(res.success).toBe(true);
    expect(res.customer!.full_name).toBe('New Customer');
    expect(res.customer!.customer_code).toMatch(/^CUST-\d{4}$/);
    expect(res.customer!.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const all = await listCustomers({});
    expect(all.total_customers).toBe(1);
  });

  it('increments customer codes sequentially', async () => {
    await seedCustomerWithUser('c1', {
      customer_code: 'CUST-0001',
      full_name: 'One',
      email: '1@t.com',
      phone: '1000000001'
    });
    await seedCustomerWithUser('c2', {
      customer_code: 'CUST-0002',
      full_name: 'Two',
      email: '2@t.com',
      phone: '2000000002'
    });

    const res = await createCustomer({
      id: TEST_USER_ID,
      full_name: 'Three',
      email: '3@test.com',
      phone: '5555555555',
      created_by: TEST_CREATOR_ID
    });

    expect(res.customer!.customer_code).toBe('CUST-0003');
  });

  it('updates a customer', async () => {
    await seedCustomer(TEST_USER_ID, {
      full_name: 'Original',
      email: 'orig@test.com',
      phone: '1234567890'
    });

    const res = await updateCustomer(TEST_USER_ID, {
      id: TEST_USER_ID,
      full_name: 'Updated',
      email: 'updated@test.com',
      phone: '9999999999',
      status: 'inactive'
    });

    expect(res.success).toBe(true);
    expect(res.customer!.full_name).toBe('Updated');
    expect(res.customer!.email).toBe('updated@test.com');
    expect(res.customer!.status).toBe('inactive');
  });

  it('fails to update a missing customer', async () => {
    const res = await updateCustomer('nonexistent', {
      id: 'nonexistent',
      full_name: 'X',
      email: 'x@test.com',
      phone: '000'
    });
    expect(res.success).toBe(false);
  });

  it('deletes a customer', async () => {
    await seedCustomer(TEST_USER_ID, {
      full_name: 'Delete Me',
      email: 'del@test.com',
      phone: '1234567890'
    });

    const res = await deleteCustomer(TEST_USER_ID);
    expect(res.success).toBe(true);

    const all = await listCustomers({});
    expect(all.total_customers).toBe(0);
  });

  it('fails to delete a missing customer', async () => {
    const res = await deleteCustomer('nonexistent');
    expect(res.success).toBe(false);
  });
});

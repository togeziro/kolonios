// Shared helpers for database integration tests.
//
// The data-access modules in src/lib/db connect to the test database via the
// DATABASE_URL set in vite.config.ts / vitest.setup.ts. These helpers let each
// test start from a clean, known state by truncating every table and seeding
// only what the test needs.
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema/products';
import { notifications } from '@/lib/db/schema/notifications';
import { customers } from '@/lib/db/schema/customers';
import { departments, designations, employees } from '@/lib/db/schema/masterdata';
import {
  employeeShifts,
  leaves,
  performanceReports,
  locations,
  shifts
} from '@/lib/db/schema/attendance';
import { user, session, account, verification } from '@/lib/db/auth-schema';
import type { NewProduct } from '@/lib/db/schema/products';

export async function resetDatabase() {
  await db.delete(notifications);
  await db.delete(products);
}

export async function resetAllTables() {
  await db.delete(employeeShifts);
  await db.delete(leaves);
  await db.delete(performanceReports);
  await db.delete(customers);
  await db.delete(employees);
  await db.delete(designations);
  await db.delete(departments);
  await db.delete(locations);
  await db.delete(shifts);
  await db.delete(notifications);
  await db.delete(products);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(user);
}

export async function seedUser(id: string, overrides: Partial<typeof user.$inferInsert> = {}) {
  await db.insert(user).values({
    id,
    name: 'Test User',
    email: `${id}@test.com`,
    role: 'employee',
    emailVerified: true,
    ...overrides
  });
}

export async function seedDepartment(overrides: Partial<typeof departments.$inferInsert> = {}) {
  const [dept] = await db
    .insert(departments)
    .values({ name: 'Engineering', code: 'ENG', ...overrides })
    .returning();
  return dept;
}

export async function seedDesignation(
  departmentId: number,
  overrides: Partial<typeof designations.$inferInsert> = {}
) {
  const [desig] = await db
    .insert(designations)
    .values({ name: 'Developer', code: 'DEV', department_id: departmentId, ...overrides })
    .returning();
  return desig;
}

export async function seedLocation(overrides: Partial<typeof locations.$inferInsert> = {}) {
  const [loc] = await db
    .insert(locations)
    .values({
      name: 'Main Office',
      latitude: 40.7128,
      longitude: -74.006,
      radius: 100,
      ...overrides
    })
    .returning();
  return loc;
}

export async function seedShift(overrides: Partial<typeof shifts.$inferInsert> = {}) {
  const [s] = await db
    .insert(shifts)
    .values({ name: 'Morning', start_time: '09:00', end_time: '17:00', ...overrides })
    .returning();
  return s;
}

export function makeProduct(overrides: Partial<NewProduct> = {}): NewProduct {
  return {
    name: 'Test Product',
    description: 'A product used in tests.',
    price: '19.99',
    category: 'Electronics',
    photo_url: 'https://example.com/p.png',
    ...overrides
  };
}

export async function seedProducts(rows: Partial<NewProduct>[]) {
  return db
    .insert(products)
    .values(rows.map((r) => makeProduct(r)))
    .returning();
}

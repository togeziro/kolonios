// Shared helpers for database integration tests.
//
// The data-access modules in src/lib/db connect to the test database via the
// DATABASE_URL set in vite.config.ts / vitest.setup.ts. These helpers let each
// test start from a clean, known state by truncating every table and seeding
// only what the test needs.
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema/products';
import { notifications } from '@/lib/db/schema/notifications';
import type { NewProduct } from '@/lib/db/schema/products';

export async function resetDatabase() {
  await db.delete(notifications);
  await db.delete(products);
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

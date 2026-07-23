import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from './products';
import { resetDatabase, seedProducts } from '@/test-utils/db';
import { db } from '@/lib/db';
import { products } from './schema/products';

async function allProducts() {
  return db.select().from(products).orderBy(products.id);
}

describe('products data access (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedProducts([
      { name: 'Alpha', category: 'Electronics', price: '10.00', description: 'first' },
      { name: 'Beta', category: 'Books', price: '20.00', description: 'second' },
      { name: 'Gamma', category: 'Electronics', price: '30.00', description: 'third' },
      { name: 'Delta Book', category: 'Books', price: '40.00', description: 'fourth' }
    ]);
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it('lists products with pagination metadata', async () => {
    const res = await getProducts({ page: 1, limit: 10 });
    expect(res.success).toBe(true);
    expect(res.total_products).toBe(4);
    expect(res.limit).toBe(10);
    expect(res.offset).toBe(0);
    expect(res.products).toHaveLength(4);
  });

  it('paginates results', async () => {
    const page1 = await getProducts({ page: 1, limit: 2 });
    const page2 = await getProducts({ page: 2, limit: 2 });
    expect(page1.products).toHaveLength(2);
    expect(page2.products).toHaveLength(2);
    expect(page1.products[0].id).not.toBe(page2.products[0].id);
  });

  it('serializes price to a number and dates to ISO strings', async () => {
    const res = await getProducts({});
    expect(typeof res.products[0].price).toBe('number');
    expect(res.products[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('filters by a single category', async () => {
    const res = await getProducts({ categories: 'Electronics' });
    expect(res.total_products).toBe(2);
    expect(res.products.every((p) => p.category === 'Electronics')).toBe(true);
  });

  it('filters by multiple comma-separated categories', async () => {
    const res = await getProducts({ categories: 'Electronics,Books' });
    expect(res.total_products).toBe(4);
  });

  it('searches across name, description and category', async () => {
    const byName = await getProducts({ search: 'Delta' });
    expect(byName.total_products).toBe(1);

    const byDesc = await getProducts({ search: 'third' });
    expect(byDesc.total_products).toBe(1);

    const byCat = await getProducts({ search: 'books' });
    expect(byCat.total_products).toBe(2);
  });

  it('sorts by price descending', async () => {
    const res = await getProducts({ sort: JSON.stringify([{ id: 'price', desc: true }]) });
    expect(res.products.map((p) => p.price)).toEqual([40, 30, 20, 10]);
  });

  it('sorts by name ascending', async () => {
    const res = await getProducts({ sort: JSON.stringify([{ id: 'name', desc: false }]) });
    expect(res.products.map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Delta Book', 'Gamma']);
  });

  it('ignores invalid sort JSON and keeps default order', async () => {
    const res = await getProducts({ sort: 'not-json' });
    expect(res.products).toHaveLength(4);
  });

  it('gets a product by id', async () => {
    const [created] = await allProducts();
    const res = await getProductById(created.id);
    expect(res.success).toBe(true);
    expect(res.product.id).toBe(created.id);
  });

  it('reports failure for a missing product id', async () => {
    const res = await getProductById(999_999);
    expect(res.success).toBe(false);
  });

  it('creates a product and assigns a slingacademy photo url', async () => {
    const res = await createProduct({
      name: 'New Widget',
      description: 'A brand new widget',
      price: 12.5,
      category: 'Toys'
    });
    expect(res.success).toBe(true);
    expect(res.product.name).toBe('New Widget');
    expect(res.product.photo_url).toMatch(/sample-products\/\d+\.png$/);
    expect(res.product.price).toBe(12.5);

    const rows = await allProducts();
    expect(rows).toHaveLength(5);
  });

  it('updates a product', async () => {
    const [created] = await allProducts();
    const res = await updateProduct(created.id, {
      name: 'Renamed',
      description: 'updated desc',
      price: 99.99,
      category: 'Jewelry'
    });
    expect(res.success).toBe(true);
    expect(res.product!.name).toBe('Renamed');
    expect(res.product!.price).toBe(99.99);
    expect(res.product!.category).toBe('Jewelry');
  });

  it('fails to update a missing product', async () => {
    const res = await updateProduct(999_999, {
      name: 'X',
      description: 'Y',
      price: 1,
      category: 'Toys'
    });
    expect(res.success).toBe(false);
  });

  it('deletes a product', async () => {
    const [created] = await allProducts();
    const res = await deleteProduct(created.id);
    expect(res.success).toBe(true);
    expect(await allProducts()).toHaveLength(3);
  });

  it('fails to delete a missing product', async () => {
    const res = await deleteProduct(999_999);
    expect(res.success).toBe(false);
    expect(await allProducts()).toHaveLength(4);
  });
});

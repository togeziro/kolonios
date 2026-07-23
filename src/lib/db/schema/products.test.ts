import { describe, expect, it } from 'vitest';
import { products, productCategoryEnum } from './products';

describe('products schema', () => {
  it('defines the full category enum', () => {
    expect(productCategoryEnum.enumValues).toEqual([
      'Electronics',
      'Furniture',
      'Clothing',
      'Toys',
      'Groceries',
      'Books',
      'Jewelry',
      'Beauty Products'
    ]);
  });

  it('has an auto-incrementing primary key', () => {
    expect(products.id.primary).toBe(true);
    expect(products.id.getSQLType()).toBe('serial');
  });

  it('requires name, description, price and category', () => {
    expect(products.name.notNull).toBe(true);
    expect(products.description.notNull).toBe(true);
    expect(products.price.notNull).toBe(true);
    expect(products.category.notNull).toBe(true);
  });

  it('stores price as a fixed numeric(10, 2)', () => {
    expect(products.price.getSQLType()).toBe('numeric(10, 2)');
  });

  it('allows a nullable photo_url', () => {
    expect(products.photo_url.notNull).toBe(false);
  });

  it('tracks created_at and updated_at with defaults', () => {
    expect(products.created_at.notNull).toBe(true);
    expect(products.updated_at.notNull).toBe(true);
    // defaultNow() stores a SQL default expression on the column.
    expect(products.created_at.default).toBeDefined();
    expect(products.updated_at.default).toBeDefined();
  });
});

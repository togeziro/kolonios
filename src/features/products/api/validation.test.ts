import { describe, expect, it } from 'vitest';
import { productFiltersSchema, productIdSchema, productMutationSchema } from './validation';

describe('productFiltersSchema', () => {
  it('accepts an empty object', () => {
    expect(productFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('coerces page and limit from strings', () => {
    const res = productFiltersSchema.safeParse({ page: '1', limit: '20' });
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ page: 1, limit: 20 });
  });

  it('rejects non-positive page and limit above 100', () => {
    expect(productFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(productFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('productIdSchema', () => {
  it('coerces a positive integer', () => {
    expect(productIdSchema.parse('42')).toBe(42);
    expect(() => productIdSchema.parse('0')).toThrow();
    expect(() => productIdSchema.parse('-3')).toThrow();
  });
});

describe('productMutationSchema', () => {
  const valid = { name: 'Widget', category: 'Tools', price: 9.99, description: 'A widget' };

  it('accepts a valid payload', () => {
    expect(productMutationSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing or empty fields', () => {
    expect(productMutationSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    expect(productMutationSchema.safeParse({ ...valid, category: '' }).success).toBe(false);
    expect(productMutationSchema.safeParse({ ...valid, description: '' }).success).toBe(false);
    expect(productMutationSchema.safeParse({ ...valid, price: 0 }).success).toBe(false);
  });

  it('coerces price from a string', () => {
    expect(productMutationSchema.safeParse({ ...valid, price: '9.99' }).success).toBe(true);
  });
});

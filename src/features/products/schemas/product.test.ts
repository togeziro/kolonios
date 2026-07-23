import { describe, expect, it } from 'vitest';
import { productSchema, type ProductFormValues } from './product';

describe('product form validation', () => {
  it('rejects missing image file', () => {
    const result = productSchema.safeParse({
      image: [],
      name: 'Foo',
      category: 'Electronics',
      price: 10,
      description: 'A decent description'
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Image is required.');
  });

  it('rejects oversized image (>5 MB)', () => {
    const fakeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'big.png', {
      type: 'image/png'
    });
    const result = productSchema.safeParse({
      image: [fakeFile],
      name: 'Foo',
      category: 'Electronics',
      price: 10,
      description: 'A decent description'
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Max file size is 5MB.');
  });

  it('rejects disallowed image mime type', () => {
    const fakeFile = new File(['data'], 'file.gif', { type: 'image/gif' });
    const result = productSchema.safeParse({
      image: [fakeFile],
      name: 'Foo',
      category: 'Electronics',
      price: 10,
      description: 'A decent description'
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain('.webp files are accepted.');
  });

  it('requires a non-empty name (min 2)', () => {
    const result = productSchema.safeParse({
      image: [new File(['x'], 'x.png', { type: 'image/png' })],
      name: '',
      category: 'Electronics',
      price: 10,
      description: 'A decent description'
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Product name must be at least 2 characters.');
  });

  it('requires a selected category', () => {
    const result = productSchema.safeParse({
      image: [new File(['x'], 'x.png', { type: 'image/png' })],
      name: 'Foo',
      category: '',
      price: 10,
      description: 'A decent description'
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Please select a category');
  });

  it('requires a price number', () => {
    const result = productSchema.safeParse({
      image: [new File(['x'], 'x.png', { type: 'image/png' })],
      name: 'Foo',
      category: 'Electronics',
      price: undefined,
      description: 'A decent description'
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Price is required');
  });

  it('requires a decent description (min 10)', () => {
    const result = productSchema.safeParse({
      image: [new File(['x'], 'x.png', { type: 'image/png' })],
      name: 'Foo',
      category: 'Electronics',
      price: 10,
      description: 'Short'
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Description must be at least 10 characters.');
  });

  it('accepts a valid payload', () => {
    const result = productSchema.safeParse({
      image: [new File(['x'], 'x.png', { type: 'image/png' })],
      name: 'Wireless Mouse',
      category: 'Electronics',
      price: 25.99,
      description: 'A high‑precision wireless mouse for office use.'
    });
    expect(result.success).toBe(true);
    const data = result.data!;
    expect(data.name).toBe('Wireless Mouse');
    expect(data.price).toBe(25.99);
  });
});

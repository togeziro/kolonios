import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getProductsFn: vi.fn(),
  getProductByIdFn: vi.fn(),
  createProductFn: vi.fn(),
  updateProductFn: vi.fn(),
  deleteProductFn: vi.fn()
}));

import { productKeys } from './queries';
import { productByIdQueryOptions, productsQueryOptions } from './queries';
import { createProductMutation, deleteProductMutation, updateProductMutation } from './mutations';
import {
  createProductFn,
  deleteProductFn,
  getProductByIdFn,
  getProductsFn,
  updateProductFn
} from './service';

describe('productKeys', () => {
  it('shapes query keys', () => {
    expect(productKeys.all).toEqual(['products']);
    const filters = { page: 1 };
    expect(productKeys.list(filters)).toEqual(['products', 'list', filters]);
    expect(productKeys.detail(7)).toEqual(['products', 'detail', 7]);
  });
});

describe('product query options', () => {
  it('productsQueryOptions passes filters through', () => {
    const filters = { page: 1 };
    const options = productsQueryOptions(filters);
    expect(options.queryKey).toEqual(['products', 'list', filters]);
    options.queryFn!(undefined as never);
    expect(getProductsFn).toHaveBeenCalledWith({ data: filters });
  });

  it('productByIdQueryOptions passes the id through', () => {
    const options = productByIdQueryOptions(7);
    expect(options.queryKey).toEqual(['products', 'detail', 7]);
    options.queryFn!(undefined as never);
    expect(getProductByIdFn).toHaveBeenCalledWith({ data: 7 });
  });
});

describe('product mutations', () => {
  const payload = { name: 'Widget', category: 'Tools', price: 9.99, description: 'A widget' };

  it('createProductMutation passes the payload through', () => {
    createProductMutation.mutationFn!(payload, undefined as never);
    expect(createProductFn).toHaveBeenCalledWith({ data: payload });
    expect(createProductMutation.onSuccess).toBeTypeOf('function');
  });

  it('updateProductMutation passes id and values through', () => {
    updateProductMutation.mutationFn!({ id: 7, values: payload }, undefined as never);
    expect(updateProductFn).toHaveBeenCalledWith({ data: { id: 7, values: payload } });
  });

  it('deleteProductMutation passes the id through', () => {
    deleteProductMutation.mutationFn!(7, undefined as never);
    expect(deleteProductFn).toHaveBeenCalledWith({ data: 7 });
  });

  it('invalidates the product list on success', async () => {
    const { getQueryClient } = await import('@/lib/query-client');
    const invalidateSpy = vi.spyOn(getQueryClient(), 'invalidateQueries');
    await createProductMutation.onSuccess!(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: productKeys.all });
  });
});

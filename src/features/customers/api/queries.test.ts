import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  listCustomersFn: vi.fn(),
  getCustomerByIdFn: vi.fn(),
  createCustomerFn: vi.fn(),
  updateCustomerFn: vi.fn(),
  deleteCustomerFn: vi.fn()
}));

import { customerKeys } from './queries';
import { customerByIdQueryOptions, customersQueryOptions } from './queries';
import {
  createCustomerMutation,
  deleteCustomerMutation,
  updateCustomerMutation
} from './mutations';
import {
  createCustomerFn,
  deleteCustomerFn,
  getCustomerByIdFn,
  listCustomersFn,
  updateCustomerFn
} from './service';

describe('customerKeys', () => {
  it('shapes query keys', () => {
    expect(customerKeys.all).toEqual(['customers']);
    const filters = { page: 1 };
    expect(customerKeys.list(filters)).toEqual(['customers', 'list', filters]);
    expect(customerKeys.detail('cus-1')).toEqual(['customers', 'detail', 'cus-1']);
  });
});

describe('customer query options', () => {
  it('customersQueryOptions passes filters through', () => {
    const filters = { page: 1 };
    const options = customersQueryOptions(filters);
    expect(options.queryKey).toEqual(['customers', 'list', filters]);
    options.queryFn!(undefined as never);
    expect(listCustomersFn).toHaveBeenCalledWith({ data: filters });
  });

  it('customerByIdQueryOptions passes the id through', () => {
    const options = customerByIdQueryOptions('cus-1');
    expect(options.queryKey).toEqual(['customers', 'detail', 'cus-1']);
    options.queryFn!(undefined as never);
    expect(getCustomerByIdFn).toHaveBeenCalledWith({ data: 'cus-1' });
  });
});

describe('customer mutations', () => {
  const payload = {
    id: 'cus-1',
    full_name: 'Acme Corp',
    email: 'acme@example.com',
    phone: '+1-555-0100'
  };

  it('createCustomerMutation passes the payload through', () => {
    createCustomerMutation.mutationFn!(payload, undefined as never);
    expect(createCustomerFn).toHaveBeenCalledWith({ data: payload });
    expect(createCustomerMutation.onSuccess).toBeTypeOf('function');
  });

  it('updateCustomerMutation passes id and values through', () => {
    updateCustomerMutation.mutationFn!({ id: 'cus-1', values: payload }, undefined as never);
    expect(updateCustomerFn).toHaveBeenCalledWith({ data: { id: 'cus-1', values: payload } });
  });

  it('deleteCustomerMutation passes the id through', () => {
    deleteCustomerMutation.mutationFn!('cus-1', undefined as never);
    expect(deleteCustomerFn).toHaveBeenCalledWith({ data: 'cus-1' });
  });

  it('invalidates the customer list on success', async () => {
    const { getQueryClient } = await import('@/lib/query-client');
    const invalidateSpy = vi.spyOn(getQueryClient(), 'invalidateQueries');
    await createCustomerMutation.onSuccess!(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: customerKeys.all });
  });
});

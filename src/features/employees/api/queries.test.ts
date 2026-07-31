import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  listEmployeesFn: vi.fn(),
  getEmployeeByIdFn: vi.fn(),
  createEmployeeFn: vi.fn(),
  updateEmployeeFn: vi.fn(),
  deleteEmployeeFn: vi.fn()
}));

import { employeeKeys } from './queries';
import { employeeByIdQueryOptions, employeesQueryOptions } from './queries';
import {
  createEmployeeMutation,
  deleteEmployeeMutation,
  updateEmployeeMutation
} from './mutations';
import {
  createEmployeeFn,
  deleteEmployeeFn,
  getEmployeeByIdFn,
  listEmployeesFn,
  updateEmployeeFn
} from './service';

describe('employeeKeys', () => {
  it('shapes query keys', () => {
    expect(employeeKeys.all).toEqual(['employees']);
    const filters = { page: 1 };
    expect(employeeKeys.list(filters)).toEqual(['employees', 'list', filters]);
    expect(employeeKeys.detail('emp-1')).toEqual(['employees', 'detail', 'emp-1']);
  });
});

describe('employee query options', () => {
  it('employeesQueryOptions passes filters through', () => {
    const filters = { page: 1 };
    const options = employeesQueryOptions(filters);
    expect(options.queryKey).toEqual(['employees', 'list', filters]);
    options.queryFn!(undefined as never);
    expect(listEmployeesFn).toHaveBeenCalledWith({ data: filters });
  });

  it('employeeByIdQueryOptions passes the id through', () => {
    const options = employeeByIdQueryOptions('emp-1');
    expect(options.queryKey).toEqual(['employees', 'detail', 'emp-1']);
    options.queryFn!(undefined as never);
    expect(getEmployeeByIdFn).toHaveBeenCalledWith({ data: 'emp-1' });
  });
});

describe('employee mutations', () => {
  const payload = {
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    birth_date: '1990-01-01',
    department_id: 1,
    designation_id: 2,
    join_date: '2024-01-01'
  };

  it('createEmployeeMutation passes the payload through', () => {
    createEmployeeMutation.mutationFn!(payload, undefined as never);
    expect(createEmployeeFn).toHaveBeenCalledWith({ data: payload });
    expect(createEmployeeMutation.onSuccess).toBeTypeOf('function');
  });

  it('updateEmployeeMutation passes id and values through', () => {
    updateEmployeeMutation.mutationFn!({ id: 'emp-1', values: payload }, undefined as never);
    expect(updateEmployeeFn).toHaveBeenCalledWith({
      data: { id: 'emp-1', values: payload }
    });
  });

  it('deleteEmployeeMutation passes the id through', () => {
    deleteEmployeeMutation.mutationFn!('emp-1', undefined as never);
    expect(deleteEmployeeFn).toHaveBeenCalledWith({ data: 'emp-1' });
  });

  it('invalidates the employee list on success', async () => {
    const { getQueryClient } = await import('@/lib/query-client');
    const invalidateSpy = vi.spyOn(getQueryClient(), 'invalidateQueries');
    await createEmployeeMutation.onSuccess!(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: employeeKeys.all });
  });
});

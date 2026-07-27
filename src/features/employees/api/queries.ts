import { queryOptions } from '@tanstack/react-query';
import { listEmployeesFn, getEmployeeByIdFn } from './service';
import type { EmployeeFilters, Employee } from './types';

export type { Employee };

export const employeeKeys = {
  all: ['employees'] as const,
  list: (filters: EmployeeFilters) => [...employeeKeys.all, 'list', filters] as const,
  detail: (id: string) => [...employeeKeys.all, 'detail', id] as const
};

export const employeesQueryOptions = (filters: EmployeeFilters) =>
  queryOptions({
    queryKey: employeeKeys.list(filters),
    queryFn: () => listEmployeesFn({ data: filters })
  });

export const employeeByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: employeeKeys.detail(id),
    queryFn: () => getEmployeeByIdFn({ data: id })
  });

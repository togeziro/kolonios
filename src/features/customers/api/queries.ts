import { queryOptions } from '@tanstack/react-query';
import { listCustomersFn, getCustomerByIdFn } from './service';
import type { Customer, CustomerFilters } from './types';

export type { Customer };

export const customerKeys = {
  all: ['customers'] as const,
  list: (filters: CustomerFilters) => [...customerKeys.all, 'list', filters] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const
};

export const customersQueryOptions = (filters: CustomerFilters) =>
  queryOptions({
    queryKey: customerKeys.list(filters),
    queryFn: () => listCustomersFn({ data: filters })
  });

export const customerByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: customerKeys.detail(id),
    queryFn: () => getCustomerByIdFn({ data: id })
  });

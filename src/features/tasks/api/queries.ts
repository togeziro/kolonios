import { queryOptions } from '@tanstack/react-query';
import { getMyTasksFn, getAvailableTasksFn, getTaskDetailFn } from './service';
import type { AvailableTaskFilters } from './types';

export const tasksKeys = {
  all: ['tasks'] as const,
  mine: () => [...tasksKeys.all, 'mine'] as const,
  available: (filters: AvailableTaskFilters) => [...tasksKeys.all, 'available', filters] as const,
  detail: (taskId: number) => [...tasksKeys.all, 'detail', taskId] as const
};

export const myTasksQueryOptions = () =>
  queryOptions({
    queryKey: tasksKeys.mine(),
    queryFn: () => getMyTasksFn()
  });

export const availableTasksQueryOptions = (filters: AvailableTaskFilters = {}) =>
  queryOptions({
    queryKey: tasksKeys.available(filters),
    queryFn: () => getAvailableTasksFn({ data: filters })
  });

export const taskDetailQueryOptions = (taskId: number) =>
  queryOptions({
    queryKey: tasksKeys.detail(taskId),
    queryFn: () => getTaskDetailFn({ data: { taskId } })
  });

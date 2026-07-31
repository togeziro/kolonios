import { describe, expect, it, vi } from 'vitest';
import type { AvailableTaskFilters } from './types';

vi.mock('./service', () => ({
  getMyTasksFn: vi.fn(),
  getAvailableTasksFn: vi.fn(),
  getTaskDetailFn: vi.fn()
}));

import { tasksKeys } from './queries';
import { availableTasksQueryOptions, myTasksQueryOptions, taskDetailQueryOptions } from './queries';
import { getAvailableTasksFn, getMyTasksFn, getTaskDetailFn } from './service';

describe('tasksKeys', () => {
  it('shapes query keys', () => {
    expect(tasksKeys.all).toEqual(['tasks']);
    expect(tasksKeys.mine()).toEqual(['tasks', 'mine']);
    const filters: AvailableTaskFilters = { priority: 'high' };
    expect(tasksKeys.available(filters)).toEqual(['tasks', 'available', filters]);
    expect(tasksKeys.detail(5)).toEqual(['tasks', 'detail', 5]);
  });
});

describe('task query options', () => {
  it('myTasksQueryOptions calls without args', () => {
    const options = myTasksQueryOptions();
    expect(options.queryKey).toEqual(['tasks', 'mine']);
    options.queryFn!(undefined as never);
    expect(getMyTasksFn).toHaveBeenCalledWith();
  });

  it('availableTasksQueryOptions defaults to empty filters', () => {
    const options = availableTasksQueryOptions();
    expect(options.queryKey).toEqual(['tasks', 'available', {}]);
    options.queryFn!(undefined as never);
    expect(getAvailableTasksFn).toHaveBeenCalledWith({ data: {} });
  });

  it('availableTasksQueryOptions passes filters through', () => {
    const filters: AvailableTaskFilters = { priority: 'high', locationId: 2 };
    const options = availableTasksQueryOptions(filters);
    expect(options.queryKey).toEqual(['tasks', 'available', filters]);
    options.queryFn!(undefined as never);
    expect(getAvailableTasksFn).toHaveBeenCalledWith({ data: filters });
  });

  it('taskDetailQueryOptions passes the id through', () => {
    const options = taskDetailQueryOptions(9);
    expect(options.queryKey).toEqual(['tasks', 'detail', 9]);
    options.queryFn!(undefined as never);
    expect(getTaskDetailFn).toHaveBeenCalledWith({ data: { taskId: 9 } });
  });
});

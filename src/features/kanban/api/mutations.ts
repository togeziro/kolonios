import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { addTaskFn, moveTaskFn } from './service';
import { kanbanKeys } from './queries';
import type { AddTaskPayload, MoveTaskPayload } from './types';

export const addTaskMutation = mutationOptions({
  mutationFn: (data: AddTaskPayload) => addTaskFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: kanbanKeys.all });
  },
  onError: (err) => {
    console.error('Failed to add task:', err);
  }
});

export const moveTaskMutation = mutationOptions({
  mutationFn: (data: MoveTaskPayload) => moveTaskFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: kanbanKeys.all });
  },
  onError: (err) => {
    console.error('Failed to move task:', err);
  }
});

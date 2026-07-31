import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { takeTaskFn, completeTaskFn } from './service';
import { tasksKeys } from './queries';

export function useTakeTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => takeTaskFn({ data: { taskId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success('Task taken');
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
      } else {
        toast.error(res?.message ?? 'Failed to take task');
      }
    },
    onError: () => {
      toast.error('Failed to take task');
    }
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => completeTaskFn({ data: { taskId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success('Task completed');
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
      } else {
        toast.error(res?.message ?? 'Failed to complete task');
      }
    },
    onError: () => {
      toast.error('Failed to complete task');
    }
  });
}

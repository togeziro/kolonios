import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { takeTaskFn, completeTaskFn } from './service';
import { tasksKeys } from './queries';

export function useTakeTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (taskId: number) => takeTaskFn({ data: { taskId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('task.taken'));
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
      } else {
        toast.error(res?.message ?? t('task.takeFailed'));
      }
    },
    onError: () => {
      toast.error(t('task.takeFailed'));
    }
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (taskId: number) => completeTaskFn({ data: { taskId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('task.completed'));
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
      } else {
        toast.error(res?.message ?? t('task.completeFailed'));
      }
    },
    onError: () => {
      toast.error(t('task.completeFailed'));
    }
  });
}

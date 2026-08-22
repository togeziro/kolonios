import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { updateChecklistItemFn, setGlobalNoteFn } from './service';
import { checklistKeys } from './queries';
import type { UpdateChecklistItemInput, SetGlobalNoteInput } from './validation';

function useInvalidateChecklist() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: checklistKeys.all });
}

export function useUpdateChecklistItem() {
  const invalidate = useInvalidateChecklist();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: UpdateChecklistItemInput) => updateChecklistItemFn({ data: input }),
    onSuccess: (res) => {
      if (res?.success) {
        invalidate();
      } else {
        toast.error(res?.message ?? t('checklist.updateFailed'));
      }
    },
    onError: () => toast.error(t('checklist.updateFailed'))
  });
}

export function useSetGlobalNote() {
  const invalidate = useInvalidateChecklist();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: SetGlobalNoteInput) => setGlobalNoteFn({ data: input }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('checklist.noteSaved'));
        invalidate();
      } else {
        toast.error(res?.message ?? t('checklist.updateFailed'));
      }
    },
    onError: () => toast.error(t('checklist.updateFailed'))
  });
}

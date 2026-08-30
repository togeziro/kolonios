import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  updateChecklistItemFn,
  setGlobalNoteFn,
  submitChecklistFn,
  updateChecklistStatusFn
} from './service';
import { checklistKeys } from './queries';
import type {
  UpdateChecklistItemInput,
  SetGlobalNoteInput,
  UpdateChecklistStatusInput
} from './validation';

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

const problemToastKey: Record<string, string> = {
  pendingItems: 'checklist.blockedPending',
  issueWithoutNote: 'checklist.blockedIssue'
};

export function useSubmitChecklist() {
  const invalidate = useInvalidateChecklist();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: { checklistId: number }) => submitChecklistFn({ data: input }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('checklist.submitSuccess'));
        invalidate();
      } else if (res && 'problems' in res && res.problems) {
        for (const problem of res.problems) {
          const key = problemToastKey[problem];
          if (key) toast.error(t(key));
        }
      } else {
        toast.error(res?.message ?? t('checklist.updateFailed'));
      }
    },
    onError: () => toast.error(t('checklist.updateFailed'))
  });
}

export function useUpdateChecklistStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: UpdateChecklistStatusInput) => updateChecklistStatusFn({ data: input }),
    onSuccess: (res, variables) => {
      if (res?.success) {
        toast.success(
          variables.status === 'approved'
            ? t('spvReview.approveSuccess')
            : t('spvReview.rejectSuccess')
        );
        queryClient.invalidateQueries({ queryKey: checklistKeys.reviewQueue() });
        queryClient.invalidateQueries({ queryKey: checklistKeys.all });
      } else {
        toast.error((res as { message?: string })?.message ?? t('spvReview.updateFailed'));
      }
    },
    onError: () => toast.error(t('spvReview.updateFailed'))
  });
}

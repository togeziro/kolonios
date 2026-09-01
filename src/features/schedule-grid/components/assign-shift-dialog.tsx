// @vitest-environment jsdom
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { useAppForm } from '@/components/ui/tanstack-form';
import { businessDateInTimeZone } from '@/lib/dates';
import { attendanceKeys, listShiftsQueryOptions } from '@/features/attendance/api/queries';
import { createAssignmentInlineFn } from '../api/service';
import { scheduleGridKeys } from '../api/queries';
import type { ShiftListItem } from '@/lib/db/attendance';

const POLICY_REQUIRED_FIELDS = ['late_tolerance_minutes', 'absence_cutoff_minutes'] as const;

function isPolicyMissing(shift: ShiftListItem): boolean {
  // Defensive check: post-#109 migrations guarantee these columns are
  // NOT NULL on every shift row, but legacy rows in pre-#109 databases can
  // still come back with nulls. The warning is locked into the spec for
  // ticket 03 (see spec.md "Engine delta from PR #109").
  return POLICY_REQUIRED_FIELDS.some(
    (key) => (shift as unknown as Record<string, unknown>)[key] == null
  );
}

type AssignShiftFormValues = {
  shiftId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type AssignShiftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User id for whom we're creating the assignment. */
  userId: string | null;
  /** Employee display name for the dialog header / closing note. */
  userName?: string;
};

/**
 * Inline "Assign Shift" dialog for unassigned employees (ticket 03).
 *
 * Renders inside the schedule grid page (NOT a route navigation). Uses
 * TanStack Form (`useAppForm`) with field-level `required` markers per
 * repo convention — no zod validator at the form level. The cross-field
 * `effectiveTo > effectiveFrom` rule lives in `createAssignmentInlineFn`.
 *
 * `key` is set to `userId` so a different target user triggers a clean
 * remount (form reset + closed-preview cleared) without a manual effect.
 */
export function AssignShiftDialog({
  open,
  onOpenChange,
  userId,
  userName
}: AssignShiftDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='sm:max-w-[480px]'
        // Force a remount when the target user changes so the inner form
        // re-initializes without a manual `useEffect`-driven reset.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {userId ? (
          <AssignShiftDialogBody
            key={userId}
            userId={userId}
            userName={userName}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssignShiftDialogBody({
  userId,
  userName,
  onClose
}: {
  userId: string;
  userName?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const shiftsQuery = useQuery(listShiftsQueryOptions());
  const shiftOptions = useMemo(() => {
    const rows = shiftsQuery.data?.shifts ?? [];
    return rows.map((s) => ({ value: String(s.id), label: s.name }));
  }, [shiftsQuery.data]);

  const shiftsById = useMemo(() => {
    const rows = shiftsQuery.data?.shifts ?? [];
    return new Map(rows.map((s) => [String(s.id), s] as const));
  }, [shiftsQuery.data]);

  const today = businessDateInTimeZone(new Date());
  const defaultValues: AssignShiftFormValues = {
    shiftId: '',
    effectiveFrom: today,
    effectiveTo: null
  };

  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const shiftId = Number(value.shiftId);
      let result: Awaited<ReturnType<typeof createAssignmentInlineFn>>;
      try {
        result = await createAssignmentInlineFn({
          data: {
            userId,
            shiftId,
            effectiveFrom: value.effectiveFrom,
            effectiveTo: value.effectiveTo ?? null
          }
        });
      } catch {
        // `mapDbError` always throws DomainError; the server fn does not
        // surface internal failures as a tuple. Treat the thrown error as
        // a generic failure so the user gets a toast and the dialog stays
        // open instead of stranding them on a disabled submit button.
        toast.error(t('scheduleGrid.assignDialog.errorGeneric'));
        return;
      }
      if (!result.success) {
        if (result.error === 'effectiveToBeforeFrom') {
          toast.error(t('scheduleGrid.assignDialog.errorEffectiveToBeforeFrom'));
        } else {
          toast.error(t('scheduleGrid.assignDialog.errorGeneric'));
        }
        return;
      }
      // Invalidate the grid + cross-feature attendance caches.
      queryClient.invalidateQueries({ queryKey: scheduleGridKeys.all });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });

      // Compose the success message — append the policy warning when the
      // chosen shift has no policy, and the closing-note when the previous
      // open-ended assignment was auto-closed.
      const chosenShift = shiftsById.get(value.shiftId);
      const policyMissing = chosenShift ? isPolicyMissing(chosenShift) : false;
      const parts: string[] = [t('scheduleGrid.assignDialog.success')];
      if (result.closedAssignment) {
        parts.push(
          t('scheduleGrid.assignDialog.closingNote', {
            name: userName ?? '',
            effectiveFrom: result.closedAssignment.effective_from
          })
        );
      }
      if (policyMissing) {
        parts.push(t('scheduleGrid.assignDialog.policyWarning'));
      }
      toast.success(parts.join(' '));
      onClose();
    }
  });

  // Watch the chosen shift to surface a policy-missing warning inside the
  // dialog (informational, not blocking).
  const watchedShiftId = useStore(form.store, (s) => s.values.shiftId);
  const chosenShift = watchedShiftId ? shiftsById.get(watchedShiftId) : undefined;
  const policyMissing = chosenShift ? isPolicyMissing(chosenShift) : false;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('scheduleGrid.assignDialog.title')}</DialogTitle>
        <DialogDescription>
          {t('scheduleGrid.assignDialog.description', { name: userName ?? '' })}
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className='flex flex-col gap-4'
      >
        <form.AppField name='shiftId'>
          {(field) => (
            <div className='flex flex-col gap-2'>
              <Label htmlFor={field.name}>
                {t('scheduleGrid.assignDialog.shift')}
                <span className='text-destructive'> *</span>
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => {
                  field.handleChange(v);
                  field.handleBlur();
                }}
              >
                <SelectTrigger
                  id={field.name}
                  aria-invalid={field.state.meta.errors.length > 0}
                  data-testid='assign-dialog-shift-trigger'
                >
                  <SelectValue
                    placeholder={
                      shiftsQuery.isLoading
                        ? t('common.loading')
                        : t('scheduleGrid.assignDialog.shiftPlaceholder')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {shiftOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors.length > 0 ? (
                <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
              ) : null}
              {policyMissing ? (
                <p
                  className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                  data-testid='assign-dialog-policy-warning'
                >
                  {t('scheduleGrid.assignDialog.policyWarning')}
                </p>
              ) : null}
            </div>
          )}
        </form.AppField>

        <form.AppField name='effectiveFrom'>
          {(field) => (
            <div className='flex flex-col gap-2'>
              <Label htmlFor={field.name}>
                {t('scheduleGrid.assignDialog.fromDate')}
                <span className='text-destructive'> *</span>
              </Label>
              <DatePicker
                id={field.name}
                value={field.state.value}
                onChange={(v) => {
                  field.handleChange(v ?? '');
                  field.handleBlur();
                }}
                placeholder={t('scheduleGrid.assignDialog.fromDate')}
              />
              {field.state.meta.errors.length > 0 ? (
                <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
              ) : null}
            </div>
          )}
        </form.AppField>

        <form.AppField name='effectiveTo'>
          {(field) => (
            <div className='flex flex-col gap-2'>
              <Label htmlFor={field.name}>{t('scheduleGrid.assignDialog.toDate')}</Label>
              <DatePicker
                id={field.name}
                value={field.state.value ?? undefined}
                onChange={(v) => {
                  field.handleChange(v ?? null);
                  field.handleBlur();
                }}
                placeholder={t('scheduleGrid.assignDialog.toDateHint')}
              />
              <p className='text-xs text-muted-foreground'>
                {t('scheduleGrid.assignDialog.toDateHint')}
              </p>
              {field.state.meta.errors.length > 0 ? (
                <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
              ) : null}
            </div>
          )}
        </form.AppField>

        <DialogFooter className='pt-2'>
          <Button type='button' variant='outline' onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <form.Subscribe selector={(state) => [state.isSubmitting] as const}>
            {([isSubmitting]) => (
              <Button type='submit' disabled={isSubmitting} data-testid='assign-dialog-submit'>
                {isSubmitting ? (
                  <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Icons.check className='mr-2 h-4 w-4' />
                )}
                {t('scheduleGrid.assignDialog.submit')}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </>
  );
}

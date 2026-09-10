import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useAppForm } from '@/components/ui/tanstack-form';
import { businessDateInTimeZone } from '@/lib/dates';
import { timeToSeconds } from '@/lib/attendance/schedule';
import { Icons } from '@/components/icons';
import { attendanceKeys } from '../api/queries';
import { recordManualAttendanceFn } from '../api/service';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import type { EmployeeShift } from '@/lib/domain/attendance';

export type AdminAttendanceDialogMode = 'create' | 'edit';

export type AdminAttendanceDialogInitial = {
  employeeId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  reason?: string;
};

type AdminAttendanceAddDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: AdminAttendanceDialogMode;
  initial?: AdminAttendanceDialogInitial;
};

type ManualRecordPayload = Parameters<typeof recordManualAttendanceFn>[0]['data'];

function toPayload(
  values: ManualAttendanceFormValues,
  confirmOverwrite: boolean
): ManualRecordPayload {
  return {
    employeeId: values.employeeId,
    date: values.date,
    checkInTime: values.checkInTime,
    checkOutTime: values.checkOutTime || undefined,
    reason: values.reason.trim() ? values.reason.trim() : undefined,
    confirmOverwrite
  };
}

type ManualAttendanceFormValues = {
  employeeId: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

export function AdminAttendanceAddDialog({
  open,
  onOpenChange,
  mode = 'create',
  initial
}: AdminAttendanceAddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <AdminAttendanceAddDialogBody
          key={`${mode}:${initial?.employeeId ?? ''}:${initial?.date ?? ''}`}
          mode={mode}
          initial={initial}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdminAttendanceAddDialogBody({
  mode,
  initial,
  onClose
}: {
  mode: AdminAttendanceDialogMode;
  initial?: AdminAttendanceDialogInitial;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';

  const { data: employeesData } = useQuery(employeesQueryOptions({ limit: 100 }));
  const employees = employeesData?.employees ?? [];

  const [conflict, setConflict] = useState<{ existing: EmployeeShift } | null>(null);

  const saveMutation = useMutation({
    mutationFn: (payload: ManualRecordPayload) => recordManualAttendanceFn({ data: payload }),
    onSuccess: (result) => {
      if (result.kind === 'overwrite_required') {
        setConflict({ existing: result.existing });
        return;
      }
      toast.success(t('attendanceAdmin.attendanceSaved'));
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      onClose();
    },
    onError: () => {
      // Keep the overwrite prompt open so the user can retry; a first-pass
      // failure just leaves the main dialog open for correction.
      toast.error(t('attendanceAdmin.attendanceSaveFailed'));
    }
  });

  const today = businessDateInTimeZone(new Date());

  const form = useAppForm({
    defaultValues: {
      employeeId: initial?.employeeId ?? '',
      date: initial?.date ?? today,
      checkInTime: initial?.checkInTime ?? '',
      checkOutTime: initial?.checkOutTime ?? '',
      reason: initial?.reason ?? ''
    } satisfies ManualAttendanceFormValues,
    onSubmit: async ({ value }) => {
      if (!value.employeeId || !value.date || !value.checkInTime) {
        toast.error(t('attendanceAdmin.attendanceSaveFailed'));
        return;
      }
      saveMutation.mutate(toPayload(value, false));
    }
  });

  const formValues = useStore(form.store, (s) => s.values);

  const confirmOverwrite = () => {
    saveMutation.mutate(toPayload(formValues, true));
  };

  const employeeName =
    employees.find((emp) => emp.id === formValues.employeeId)?.full_name ?? formValues.employeeId;

  const existing = conflict?.existing;
  const existingSummary = existing
    ? `${existing.check_in_time ?? '—'} – ${existing.check_out_time ?? '—'}`
    : '';

  const title = t(
    isEdit ? 'attendanceAdmin.editAttendanceTitle' : 'attendanceAdmin.addAttendanceTitle'
  );
  const description = t(
    isEdit
      ? 'attendanceAdmin.editAttendanceDescription'
      : 'attendanceAdmin.addAttendanceDescription'
  );
  const saveLabel = t(
    isEdit ? 'attendanceAdmin.editAttendanceSave' : 'attendanceAdmin.attendanceSave'
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className='flex flex-col gap-4'
      >
        <form.AppField
          name='employeeId'
          validators={{
            onBlur: ({ value }) =>
              !value ? t('attendanceAdmin.manualEmployeeRequired') : undefined
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-2'>
              <Label htmlFor={field.name}>
                {t('attendanceAdmin.employee')}
                {!isEdit && <span className='text-destructive'> *</span>}
              </Label>
              <NativeSelect
                id={field.name}
                data-testid='manual-attendance-employee'
                value={field.state.value}
                disabled={isEdit}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  field.handleBlur();
                }}
              >
                <option value=''>--</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name ?? emp.email}
                  </option>
                ))}
              </NativeSelect>
              {isEdit ? (
                <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                  <Lock className='h-3 w-3' />
                  {t('attendanceAdmin.editAttendanceLockHint')}
                </p>
              ) : null}
              {field.state.meta.errors.length > 0 ? (
                <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
              ) : null}
            </div>
          )}
        </form.AppField>

        <form.AppField
          name='date'
          validators={{
            onBlur: ({ value }) =>
              !value || !DATE_PATTERN.test(value)
                ? t('attendanceAdmin.manualDateRequired')
                : undefined
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-2'>
              <Label htmlFor={field.name}>
                {t('common.date')}
                {!isEdit && <span className='text-destructive'> *</span>}
              </Label>
              <DatePicker
                id={field.name}
                value={field.state.value}
                disabled={isEdit}
                onChange={(v) => {
                  field.handleChange(v ?? '');
                  field.handleBlur();
                }}
              />
              {field.state.meta.errors.length > 0 ? (
                <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
              ) : null}
            </div>
          )}
        </form.AppField>

        <div className='grid gap-4 sm:grid-cols-2'>
          <form.AppField
            name='checkInTime'
            validators={{
              onBlur: ({ value }) => {
                if (!value) return t('attendanceAdmin.manualCheckInRequired');
                if (!TIME_PATTERN.test(value)) return t('attendanceAdmin.manualTimeInvalid');
                return undefined;
              }
            }}
          >
            {(field) => (
              <div className='flex flex-col gap-2'>
                <Label htmlFor={field.name}>
                  {t('attendanceAdmin.attendanceClockIn')}
                  <span className='text-destructive'> *</span>
                </Label>
                <Input
                  id={field.name}
                  type='time'
                  data-testid='manual-attendance-check-in'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={() => field.handleBlur()}
                />
                {field.state.meta.errors.length > 0 ? (
                  <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
                ) : null}
              </div>
            )}
          </form.AppField>

          <form.AppField
            name='checkOutTime'
            validators={{
              onBlur: ({ value, fieldApi }) => {
                if (!value) return undefined;
                if (!TIME_PATTERN.test(value)) {
                  return t('attendanceAdmin.manualTimeInvalid');
                }
                const checkIn = fieldApi.form.getFieldValue('checkInTime');
                if (checkIn && timeToSeconds(value) < timeToSeconds(checkIn)) {
                  return t('attendanceAdmin.manualCheckOutRange');
                }
                return undefined;
              }
            }}
          >
            {(field) => (
              <div className='flex flex-col gap-2'>
                <Label htmlFor={field.name}>{t('attendanceAdmin.attendanceClockOut')}</Label>
                <Input
                  id={field.name}
                  type='time'
                  data-testid='manual-attendance-check-out'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={() => field.handleBlur()}
                />
                {field.state.meta.errors.length > 0 ? (
                  <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
                ) : null}
              </div>
            )}
          </form.AppField>
        </div>

        <form.AppField
          name='reason'
          validators={{
            onBlur: ({ value }) =>
              value && value.length > 1000 ? t('attendanceAdmin.manualReasonTooLong') : undefined
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-2'>
              <Label htmlFor={field.name}>{t('attendanceAdmin.attendanceReasonLabel')}</Label>
              <Textarea
                id={field.name}
                maxLength={1000}
                placeholder={t('attendanceAdmin.attendanceReasonPlaceholder')}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={() => field.handleBlur()}
              />
              {field.state.meta.errors.length > 0 ? (
                <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
              ) : null}
            </div>
          )}
        </form.AppField>

        <DialogFooter className='pt-2'>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            disabled={saveMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type='submit'
            data-testid='manual-attendance-save'
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
            ) : null}
            {saveLabel}
          </Button>
        </DialogFooter>
      </form>

      <AlertDialog
        open={conflict !== null}
        onOpenChange={(open) => {
          if (!open) setConflict(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('attendanceAdmin.attendanceOverwritePromptTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('attendanceAdmin.attendanceOverwritePromptDescription', {
                employee: employeeName,
                date: formValues.date,
                existing: existingSummary
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveMutation.isPending}>
              {t('attendanceAdmin.attendanceOverwriteCancelAction')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saveMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                confirmOverwrite();
              }}
            >
              {saveMutation.isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : null}
              {t('attendanceAdmin.attendanceOverwriteConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PayrollAttendanceOverride } from '@/lib/db/schema/payroll';
import { PAYROLL_EDITABLE_STATUSES, type PayrollPeriodStatus } from '@/features/payroll/api/types';

export type OverrideDraft = {
  scheduledDays: string;
  payableDays: string;
  workedHours: string;
  permitHours: string;
  shortfallHours: string;
};

export const EMPTY_OVERRIDE_DRAFT: OverrideDraft = {
  scheduledDays: '',
  payableDays: '',
  workedHours: '',
  permitHours: '',
  shortfallHours: ''
};

const FIELDS: Array<[keyof OverrideDraft, string]> = [
  ['scheduledDays', 'payroll.scheduledDays'],
  ['payableDays', 'payroll.payableDays'],
  ['workedHours', 'payroll.workedHours'],
  ['permitHours', 'payroll.permitHours'],
  ['shortfallHours', 'payroll.shortfallHours']
];

export function draftToOverrideValues(draft: OverrideDraft): {
  scheduledDays: number | undefined;
  payableDays: number | undefined;
  workedHours: number | undefined;
  permitHours: number | undefined;
  shortfallHours: number | undefined;
} {
  return {
    scheduledDays: fieldToNumber(draft.scheduledDays),
    payableDays: fieldToNumber(draft.payableDays),
    workedHours: fieldToNumber(draft.workedHours),
    permitHours: fieldToNumber(draft.permitHours),
    shortfallHours: fieldToNumber(draft.shortfallHours)
  };
}

function fieldToNumber(field: string): number | undefined {
  return field.trim() === '' ? undefined : Number(field);
}

function rowToDraft(row: PayrollAttendanceOverride): OverrideDraft {
  return {
    scheduledDays: row.scheduled_days != null ? String(row.scheduled_days) : '',
    payableDays: row.payable_days != null ? String(row.payable_days) : '',
    workedHours: row.worked_hours != null ? String(row.worked_hours) : '',
    permitHours: row.permit_hours != null ? String(row.permit_hours) : '',
    shortfallHours: row.shortfall_hours != null ? String(row.shortfall_hours) : ''
  };
}

export function AttendanceOverrideDialog({
  open,
  periodStatus,
  row,
  isLoading,
  isError,
  isSaving,
  onSave,
  onOpenChange,
  t
}: {
  open: boolean;
  periodStatus: PayrollPeriodStatus;
  row: PayrollAttendanceOverride | null;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  onSave: (draft: OverrideDraft) => void;
  onOpenChange: (open: boolean) => void;
  t: TFunction;
}) {
  const [draft, setDraft] = useState<OverrideDraft>(EMPTY_OVERRIDE_DRAFT);
  // Reset the draft on mount and whenever the dialog opens or the source row
  // changes (adjust-state-during-render pattern; replaces the previous
  // effect). `null` marks "not yet seen" so the first render also syncs.
  const [prevOpenRow, setPrevOpenRow] = useState<{
    open: boolean;
    row: PayrollAttendanceOverride | null;
  } | null>(null);
  if (!prevOpenRow || prevOpenRow.open !== open || prevOpenRow.row !== row) {
    setPrevOpenRow({ open, row });
    if (open) setDraft(row ? rowToDraft(row) : EMPTY_OVERRIDE_DRAFT);
  }
  const periodLocked = !PAYROLL_EDITABLE_STATUSES.includes(periodStatus);
  const hasInvalidNumber = FIELDS.some(([field]) => {
    const value = draft[field];
    return value.trim() !== '' && Number.isNaN(Number(value));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('payroll.attendanceOverride')}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
        ) : isError ? (
          <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
        ) : (
          <>
            <p className='text-sm text-muted-foreground'>{t('payroll.overrideHint')}</p>
            <div className='grid gap-3 sm:grid-cols-2'>
              {FIELDS.map(([field, label]) => (
                <div key={field}>
                  <Label htmlFor={`override-${field}`}>{t(label)}</Label>
                  <Input
                    id={`override-${field}`}
                    type='number'
                    value={draft[field]}
                    onChange={(e) =>
                      setDraft((current) => ({ ...current, [field]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            {hasInvalidNumber && (
              <p className='text-sm text-destructive' role='alert'>
                {t('payroll.invalidNumber')}
              </p>
            )}
          </>
        )}
        <Button
          onClick={() => onSave(draft)}
          disabled={isLoading || isError || isSaving || periodLocked || hasInvalidNumber}
        >
          {t('common.save')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

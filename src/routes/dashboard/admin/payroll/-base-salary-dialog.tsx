import { useState } from 'react';
import type { TFunction } from 'i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DatePicker } from '@/components/ui/date-picker';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ProfileData } from './-profile-types';
import { formatPayrollMoney } from './-components';

type DetailBasis = 'per_month' | 'per_attendance';

type MoneyField =
  | 'amount'
  | 'overtimeRateWorkday'
  | 'overtimeRateSaturday'
  | 'overtimeRateSunday'
  | 'overtimeRateHoliday'
  | 'leaveHourDeduction'
  | 'shortfallHourDeduction';

export type SalaryDetailDraft = {
  key: number;
  description: string;
  amount: string;
  billingBasis: DetailBasis;
};

export type BaseSalaryDraft = {
  salaryType: 'monthly' | 'daily' | 'hourly';
  amount: string;
  effectiveFrom: string;
  effectiveTo: string;
  departmentId: number | null;
  designationId: number | null;
  overtimeWageType: 'hourly' | 'daily';
  overtimeRateWorkday: string;
  overtimeRateSaturday: string;
  overtimeRateSunday: string;
  overtimeRateHoliday: string;
  leaveHourDeduction: string;
  shortfallHourDeduction: string;
  absenceDeductionMode: 'automatic' | 'manual';
  details: SalaryDetailDraft[];
};

export const EMPTY_BASE_SALARY_DRAFT: BaseSalaryDraft = {
  salaryType: 'monthly',
  amount: '',
  effectiveFrom: '',
  effectiveTo: '',
  departmentId: null,
  designationId: null,
  overtimeWageType: 'hourly',
  overtimeRateWorkday: '0',
  overtimeRateSaturday: '0',
  overtimeRateSunday: '0',
  overtimeRateHoliday: '0',
  leaveHourDeduction: '0',
  shortfallHourDeduction: '0',
  absenceDeductionMode: 'automatic',
  details: []
};

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextDayISO(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// A save always creates a NEW version (the create path of
// upsertVersionedRecord), so an existing config must be dated strictly after
// its current version starts, otherwise the close-old/insert-new dance would
// collide on the (employee, effective_from) unique index.
export function defaultEffectiveFrom(
  assignment: { effective_from: string } | null | undefined
): string {
  const today = todayISO();
  if (!assignment) return today;
  return nextDayISO(assignment.effective_from > today ? assignment.effective_from : today);
}

export function totalPayroll(details: Array<{ amount: string }>): number {
  return details.reduce((sum, detail) => {
    const value = Number(detail.amount);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

export function profileToBaseSalaryDraft(profile: ProfileData | null): BaseSalaryDraft {
  const assignment = profile?.assignment;
  return {
    salaryType: assignment?.salary_type ?? EMPTY_BASE_SALARY_DRAFT.salaryType,
    amount: assignment?.amount ?? '',
    effectiveFrom: defaultEffectiveFrom(assignment),
    effectiveTo: assignment?.effective_to ?? '',
    departmentId: assignment?.department_id ?? null,
    designationId: assignment?.designation_id ?? null,
    overtimeWageType: assignment?.overtime_wage_type ?? EMPTY_BASE_SALARY_DRAFT.overtimeWageType,
    overtimeRateWorkday: assignment?.overtime_rate_workday ?? '0',
    overtimeRateSaturday: assignment?.overtime_rate_saturday ?? '0',
    overtimeRateSunday: assignment?.overtime_rate_sunday ?? '0',
    overtimeRateHoliday: assignment?.overtime_rate_holiday ?? '0',
    leaveHourDeduction: assignment?.leave_hour_deduction ?? '0',
    shortfallHourDeduction: assignment?.shortfall_hour_deduction ?? '0',
    absenceDeductionMode:
      assignment?.absence_deduction_mode ?? EMPTY_BASE_SALARY_DRAFT.absenceDeductionMode,
    details: (profile?.salaryDetails ?? []).map((detail) => ({
      key: detail.id,
      id: detail.id,
      description: detail.description,
      amount: detail.amount,
      billingBasis: detail.billing_basis
    }))
  };
}

function draftsMatch(a: BaseSalaryDraft, b: BaseSalaryDraft): boolean {
  return (
    a.salaryType === b.salaryType &&
    a.amount === b.amount &&
    a.effectiveFrom === b.effectiveFrom &&
    a.effectiveTo === b.effectiveTo &&
    a.departmentId === b.departmentId &&
    a.designationId === b.designationId &&
    a.overtimeWageType === b.overtimeWageType &&
    a.overtimeRateWorkday === b.overtimeRateWorkday &&
    a.overtimeRateSaturday === b.overtimeRateSaturday &&
    a.overtimeRateSunday === b.overtimeRateSunday &&
    a.overtimeRateHoliday === b.overtimeRateHoliday &&
    a.leaveHourDeduction === b.leaveHourDeduction &&
    a.shortfallHourDeduction === b.shortfallHourDeduction &&
    a.absenceDeductionMode === b.absenceDeductionMode &&
    a.details.length === b.details.length &&
    a.details.every((detail, index) => {
      const other = b.details[index];
      return (
        detail.description === other?.description &&
        detail.amount === other?.amount &&
        detail.billingBasis === other?.billingBasis
      );
    })
  );
}

export function baseSalaryDraftsEqual(a: BaseSalaryDraft, b: BaseSalaryDraft): boolean {
  return draftsMatch(a, b);
}

function toMoney(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type BaseSalaryMutation = {
  employeeId: string;
  kind: 'base-salary';
  values: {
    salaryType: 'monthly' | 'daily' | 'hourly';
    amount: number;
    effectiveFrom: string;
    effectiveTo?: string;
    departmentId?: number | null;
    designationId?: number | null;
    overtimeWageType: 'hourly' | 'daily';
    overtimeRateWorkday: number;
    overtimeRateSaturday: number;
    overtimeRateSunday: number;
    overtimeRateHoliday: number;
    leaveHourDeduction: number;
    shortfallHourDeduction: number;
    absenceDeductionMode: 'automatic' | 'manual';
    details: Array<{
      description: string;
      amount: number;
      billingBasis: DetailBasis;
    }>;
  };
};

export function draftToBaseSalaryValues(
  draft: BaseSalaryDraft,
  employeeId: string
): BaseSalaryMutation {
  return {
    employeeId,
    kind: 'base-salary',
    values: {
      salaryType: draft.salaryType,
      amount: toMoney(draft.amount),
      effectiveFrom: draft.effectiveFrom,
      effectiveTo: draft.effectiveTo || undefined,
      departmentId: draft.departmentId,
      designationId: draft.designationId,
      overtimeWageType: draft.overtimeWageType,
      overtimeRateWorkday: toMoney(draft.overtimeRateWorkday),
      overtimeRateSaturday: toMoney(draft.overtimeRateSaturday),
      overtimeRateSunday: toMoney(draft.overtimeRateSunday),
      overtimeRateHoliday: toMoney(draft.overtimeRateHoliday),
      leaveHourDeduction: toMoney(draft.leaveHourDeduction),
      shortfallHourDeduction: toMoney(draft.shortfallHourDeduction),
      absenceDeductionMode: draft.absenceDeductionMode,
      details: draft.details.map((detail) => ({
        description: detail.description.trim(),
        amount: toMoney(detail.amount),
        billingBasis: detail.billingBasis
      }))
    }
  };
}

const MONEY_FIELDS: Array<[MoneyField, string]> = [
  ['amount', 'payroll.amount'],
  ['overtimeRateWorkday', 'payroll.rateWorkday'],
  ['overtimeRateSaturday', 'payroll.rateSaturday'],
  ['overtimeRateSunday', 'payroll.rateSunday'],
  ['overtimeRateHoliday', 'payroll.rateHoliday'],
  ['leaveHourDeduction', 'payroll.leaveHourDeduction'],
  ['shortfallHourDeduction', 'payroll.shortfallDeduction']
];

function hasInvalidMoney(value: string) {
  return value.trim() !== '' && (Number.isNaN(Number(value)) || Number(value) < 0);
}

export function BaseSalaryDialog({
  open,
  employeeName,
  profile,
  employees,
  isLoading,
  isError,
  isSaving,
  canEdit,
  onSave,
  onAlign,
  onOpenChange,
  t
}: {
  open: boolean;
  employeeName?: string;
  profile: ProfileData | null;
  employees: Array<{ id: string; full_name: string }>;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  canEdit: boolean;
  onSave: (draft: BaseSalaryDraft) => void;
  onAlign: (targetIds: string[]) => void;
  onOpenChange: (open: boolean) => void;
  t: TFunction;
}) {
  const [draft, setDraft] = useState<BaseSalaryDraft>(EMPTY_BASE_SALARY_DRAFT);
  const [seed, setSeed] = useState<BaseSalaryDraft>(EMPTY_BASE_SALARY_DRAFT);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [alignSelected, setAlignSelected] = useState<string[]>([]);
  // Reseed only when the dialog opens or a different assignment lands (keyed
  // by assignment id, not object identity, so a background refetch of the
  // same row never wipes in-progress edits). Adjust-state-during-render
  // pattern; replaces an effect.
  const syncKey = open ? String(profile?.assignment?.id ?? 'none') : 'closed';
  const [prevSyncKey, setPrevSyncKey] = useState<string | null>(null);
  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey);
    if (open && syncKey !== 'none') {
      const seeded = profileToBaseSalaryDraft(profile);
      setSeed(seeded);
      setDraft(seeded);
    } else if (open && syncKey === 'none') {
      const seeded = profileToBaseSalaryDraft(profile);
      setSeed(seeded);
      setDraft(seeded);
    }
    setConfirmDiscard(false);
    setAlignOpen(false);
    setAlignSelected([]);
  }
  const dirty = !baseSalaryDraftsEqual(seed, draft);
  const handleOpenChange = (next: boolean) => {
    if (!next && dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };
  const setField = <K extends keyof BaseSalaryDraft>(field: K, value: BaseSalaryDraft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const addDetail = () =>
    setDraft((current) => ({
      ...current,
      details: [
        ...current.details,
        {
          key: Math.min(-1, ...current.details.map((detail) => detail.key)) - 1,
          description: '',
          amount: '',
          billingBasis: 'per_month'
        }
      ]
    }));
  const removeDetail = (key: number) =>
    setDraft((current) => ({
      ...current,
      details: current.details.filter((detail) => detail.key !== key)
    }));
  const moneyInvalid =
    MONEY_FIELDS.some(([field]) => hasInvalidMoney(draft[field])) ||
    draft.details.some(
      (detail) => hasInvalidMoney(detail.amount) || detail.description.trim() === ''
    );
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom);
  const saveDisabled = !canEdit || isLoading || isError || isSaving || !dateValid || moneyInvalid;
  const toggleAlignTarget = (id: string) =>
    setAlignSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className='max-h-[85vh] max-w-3xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex flex-wrap items-center justify-between gap-2 pr-6'>
              <span>
                {t('payroll.baseSalaryTitle')}
                {employeeName ? (
                  <span className='text-muted-foreground ml-2 text-sm font-normal'>
                    {employeeName}
                  </span>
                ) : null}
              </span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={!canEdit || isLoading || isError}
                onClick={() => setAlignOpen(true)}
              >
                {t('payroll.alignWithOthers')}
              </Button>
            </DialogTitle>
            <DialogDescription>{t('payroll.baseSalaryHint')}</DialogDescription>
          </DialogHeader>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
          ) : isError ? (
            <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
          ) : (
            <div className='space-y-5'>
              <section className='space-y-3'>
                <h4 className='text-sm font-medium'>{t('payroll.salaryAssignment')}</h4>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <div>
                    <Label htmlFor='base-salary-type'>{t('payroll.salaryType')}</Label>
                    <NativeSelect
                      id='base-salary-type'
                      className='mt-1'
                      disabled={!canEdit}
                      value={draft.salaryType}
                      onChange={(e) =>
                        setField('salaryType', e.target.value as BaseSalaryDraft['salaryType'])
                      }
                    >
                      <option value='monthly'>{t('payroll.monthly')}</option>
                      <option value='daily'>{t('payroll.daily')}</option>
                      <option value='hourly'>{t('payroll.hourly')}</option>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor='base-salary-effective-from'>{t('payroll.effectiveFrom')}</Label>
                    <DatePicker
                      id='base-salary-effective-from'
                      className='mt-1'
                      disabled={!canEdit}
                      value={draft.effectiveFrom}
                      onChange={(date) => setField('effectiveFrom', date ?? '')}
                    />
                  </div>
                  <div>
                    <Label htmlFor='base-salary-effective-to'>{t('payroll.effectiveTo')}</Label>
                    <DatePicker
                      id='base-salary-effective-to'
                      className='mt-1'
                      disabled={!canEdit}
                      value={draft.effectiveTo || undefined}
                      onChange={(date) => setField('effectiveTo', date || '')}
                    />
                  </div>
                </div>
              </section>

              <section className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h4 className='text-sm font-medium'>{t('payroll.salaryDetails')}</h4>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={!canEdit || draft.details.length >= 50}
                    onClick={addDetail}
                  >
                    {t('common.add')}
                  </Button>
                </div>
                {draft.details.map((detail) => (
                  <div
                    className='grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_140px_160px_40px]'
                    key={detail.key}
                  >
                    <div>
                      <Label htmlFor={`salary-detail-description-${detail.key}`}>
                        {t('payroll.detailDescription')}
                      </Label>
                      <Input
                        id={`salary-detail-description-${detail.key}`}
                        aria-label={t('payroll.detailDescription')}
                        className='mt-1'
                        disabled={!canEdit}
                        value={detail.description}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            details: current.details.map((row) =>
                              row.key === detail.key ? { ...row, description: e.target.value } : row
                            )
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`salary-detail-amount-${detail.key}`}>
                        {t('payroll.nominal')}
                      </Label>
                      <Input
                        id={`salary-detail-amount-${detail.key}`}
                        aria-label={t('payroll.nominal')}
                        className='mt-1'

                        disabled={!canEdit}
                        value={detail.amount}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            details: current.details.map((row) =>
                              row.key === detail.key ? { ...row, amount: e.target.value } : row
                            )
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`salary-detail-basis-${detail.key}`}>
                        {t('payroll.billingBasis')}
                      </Label>
                      <NativeSelect
                        id={`salary-detail-basis-${detail.key}`}
                        aria-label={t('payroll.billingBasis')}
                        className='mt-1'
                        disabled={!canEdit}
                        value={detail.billingBasis}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            details: current.details.map((row) =>
                              row.key === detail.key
                                ? { ...row, billingBasis: e.target.value as DetailBasis }
                                : row
                            )
                          }))
                        }
                      >
                        <option value='per_month'>{t('payroll.perMonth')}</option>
                        <option value='per_attendance'>{t('payroll.perAttendance')}</option>
                      </NativeSelect>
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      aria-label={t('common.delete')}
                      disabled={!canEdit}
                      onClick={() => removeDetail(detail.key)}
                    >
                      <X className='size-4' />
                    </Button>
                  </div>
                ))}
                <div className='flex justify-end border-t pt-2'>
                  <span className='text-sm text-muted-foreground'>
                    {`${t('payroll.totalPayrollPreview')}:`}{' '}
                    <span className='text-foreground font-semibold' data-testid='total-payroll'>
                      {formatPayrollMoney(totalPayroll(draft.details))}
                    </span>
                  </span>
                </div>
              </section>

              <section className='space-y-3'>
                <h4 className='text-sm font-medium'>{t('payroll.overtimeWages')}</h4>
                <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-5'>
                  <div>
                    <Label htmlFor='overtime-wage-type'>{t('payroll.overtimeWageType')}</Label>
                    <NativeSelect
                      id='overtime-wage-type'
                      className='mt-1'
                      disabled={!canEdit}
                      value={draft.overtimeWageType}
                      onChange={(e) =>
                        setField(
                          'overtimeWageType',
                          e.target.value as BaseSalaryDraft['overtimeWageType']
                        )
                      }
                    >
                      <option value='hourly'>{t('payroll.overtimePerHour')}</option>
                      <option value='daily'>{t('payroll.overtimePerDay')}</option>
                    </NativeSelect>
                  </div>
                  {MONEY_FIELDS.slice(1, 5).map(([field, label]) => (
                    <div key={field}>
                      <Label htmlFor={`overtime-${field}`}>{t(label)}</Label>
                      <Input
                        id={`overtime-${field}`}
                        aria-label={t(label)}
                        className='mt-1'

                        disabled={!canEdit}
                        value={draft[field]}
                        onChange={(e) => setField(field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className='space-y-3'>
                <h4 className='text-sm font-medium'>{t('payroll.deductionsDefaults')}</h4>
                <div className='grid gap-3 sm:grid-cols-3'>
                  {MONEY_FIELDS.slice(5).map(([field, label]) => (
                    <div key={field}>
                      <Label htmlFor={`deduction-${field}`}>{t(label)}</Label>
                      <Input
                        id={`deduction-${field}`}
                        aria-label={t(label)}
                        className='mt-1'

                        disabled={!canEdit}
                        value={draft[field]}
                        onChange={(e) => setField(field, e.target.value)}
                      />
                    </div>
                  ))}
                  <div>
                    <Label htmlFor='absence-deduction-mode'>
                      {t('payroll.absenceDeductionMode')}
                    </Label>
                    <NativeSelect
                      id='absence-deduction-mode'
                      className='mt-1'
                      disabled={!canEdit}
                      value={draft.absenceDeductionMode}
                      onChange={(e) =>
                        setField(
                          'absenceDeductionMode',
                          e.target.value as BaseSalaryDraft['absenceDeductionMode']
                        )
                      }
                    >
                      <option value='automatic'>{t('payroll.automatic')}</option>
                      <option value='manual'>{t('payroll.manual')}</option>
                    </NativeSelect>
                  </div>
                </div>
              </section>

              {moneyInvalid && (
                <p className='text-sm text-destructive' role='alert'>
                  {t('payroll.invalidNumber')}
                </p>
              )}
            </div>
          )}
          <div className='flex justify-end'>
            <Button onClick={() => onSave(draft)} disabled={saveDisabled}>
              {t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={alignOpen} onOpenChange={setAlignOpen}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle>{t('payroll.alignTitle')}</DialogTitle>
            <DialogDescription>{t('payroll.alignHint')}</DialogDescription>
          </DialogHeader>
          <div className='max-h-64 space-y-2 overflow-y-auto'>
            {employees.map((employee) => (
              <label className='flex items-center gap-2 text-sm' key={employee.id}>
                <input
                  type='checkbox'
                  aria-label={employee.full_name}
                  checked={alignSelected.includes(employee.id)}
                  onChange={() => toggleAlignTarget(employee.id)}
                />
                <span>{employee.full_name}</span>
              </label>
            ))}
            {employees.length === 0 && (
              <p className='text-sm text-muted-foreground'>{t('payroll.noAlignTargets')}</p>
            )}
          </div>
          <div className='flex justify-end'>
            <Button
              disabled={alignSelected.length === 0 || isSaving}
              onClick={() => {
                onAlign(alignSelected);
                setAlignOpen(false);
              }}
            >
              {t('payroll.applyAlign')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t('payroll.discardTitle')}
        description={t('payroll.discardDescription')}
        confirmLabel={t('payroll.discardConfirm')}
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

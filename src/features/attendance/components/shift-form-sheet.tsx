import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createShiftMutation, updateShiftMutation } from '../api/mutations';
import { shiftByIdQueryOptions } from '../api/queries';
import { SHIFT_COLOR_PRESETS } from '../lib/shift-colors';
import {
  ALL_DAYS,
  DAY_KEYS,
  EMPTY_SHIFT_FORM,
  shiftFormSchema,
  shiftFormToPayload,
  type ShiftFormValues,
  type ShiftWeekdayRuleFormValues
} from '../lib/shift-form';
import { useAppForm } from '@/components/ui/tanstack-form';

interface ShiftFormSheetProps {
  shiftId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftFormSheet({ shiftId, open, onOpenChange }: ShiftFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = shiftId != null;
  const [rulesOpen, setRulesOpen] = useState(true);

  const detailQuery = useQuery(shiftByIdQueryOptions(shiftId ?? null));
  const loaded = !isEdit || (detailQuery.data != null && detailQuery.data.success);

  const form = useAppForm({
    defaultValues: EMPTY_SHIFT_FORM,
    validators: { onChange: shiftFormSchema },
    onSubmit: async ({ value }) => {
      const { withBreakWindow, status } = shiftFormToPayload(value);
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: shiftId,
          ...withBreakWindow,
          status
        });
      } else {
        await createMutation.mutateAsync(withBreakWindow);
      }
    }
  });

  const createMutation = useMutation(
    mergeMutationCallbacks(createShiftMutation, {
      onSuccess: () => {
        toast.success(t('attendanceAdmin.shiftSaved'));
        // Reset before close so the next "Add" opens with a clean form.
        // (Sheet stays mounted with state otherwise.)
        form.reset(EMPTY_SHIFT_FORM);
        onOpenChange(false);
      },
      onError: () => toast.error(t('attendanceAdmin.shiftCreateFailed'))
    })
  );

  const updateMutation = useMutation(
    mergeMutationCallbacks(updateShiftMutation, {
      onSuccess: () => {
        toast.success(t('attendanceAdmin.shiftSaved'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('attendanceAdmin.shiftUpdateFailed'))
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Track the latest data-update timestamp so that a mid-edit refetch
  // (triggered by another mutation invalidating the query) resets the form
  // — without this the user could submit stale values and clobber the
  // remote change.
  const lastDataUpdatedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isEdit) return;
    const data = detailQuery.data;
    if (!data?.success || !data.shift) return;
    const ts = detailQuery.dataUpdatedAt;
    if (lastDataUpdatedAtRef.current === ts) return;
    lastDataUpdatedAtRef.current = ts;
    form.reset(toFormValues(data.shift, data.weekdayRules));
    // We intentionally key off dataUpdatedAt + the shift identity, not the
    // full payload, to avoid clobbering user edits on background refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.dataUpdatedAt, detailQuery.data?.shift?.id, form, isEdit]);

  const setRule = (index: number, patch: Partial<ShiftWeekdayRuleFormValues>) => {
    const current = form.getFieldValue('weekdayRules');
    form.setFieldValue(
      'weekdayRules',
      current.map((r: ShiftWeekdayRuleFormValues, i: number) =>
        i === index ? { ...r, ...patch } : r
      )
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t('attendanceAdmin.shiftEditDialogTitle')
              : t('attendanceAdmin.shiftNewDialogTitle')}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? t('attendanceAdmin.shiftEditDialogDescription')
              : t('attendanceAdmin.shiftNewDialogDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          {!loaded ? (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              {t('common.loading')}
            </div>
          ) : (
            <form.AppForm>
              <form.Form id='shift-form-sheet' className='space-y-6 px-2'>
                <div className='space-y-3'>
                  <h3 className='text-sm font-medium'>{t('attendanceAdmin.shiftDetails')}</h3>

                  <form.AppField name='name'>
                    {(field) => (
                      <div className='space-y-2'>
                        <Label htmlFor={field.name}>{t('attendanceAdmin.shiftName')}</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder={t('attendanceAdmin.shiftNamePlaceholder')}
                        />
                        <FieldError meta={field.state.meta} />
                      </div>
                    )}
                  </form.AppField>

                  <div className='grid grid-cols-2 gap-3'>
                    <form.AppField name='startTime'>
                      {(field) => (
                        <div className='space-y-2'>
                          <Label htmlFor={field.name}>{t('attendanceAdmin.shiftStartTime')}</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            type='time'
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          <FieldError meta={field.state.meta} />
                        </div>
                      )}
                    </form.AppField>
                    <form.AppField name='endTime'>
                      {(field) => (
                        <div className='space-y-2'>
                          <Label htmlFor={field.name}>{t('attendanceAdmin.shiftEndTime')}</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            type='time'
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          <FieldError meta={field.state.meta} />
                        </div>
                      )}
                    </form.AppField>
                  </div>

                  <div className='space-y-2'>
                    <Label>{t('attendanceAdmin.shiftBreakWindow')}</Label>
                    <p className='text-muted-foreground text-xs'>
                      {t('attendanceAdmin.shiftBreakWindowHint')}
                    </p>
                    <div className='grid grid-cols-3 gap-3'>
                      <form.AppField name='breakStart'>
                        {(field) => (
                          <div className='space-y-1'>
                            <Label htmlFor={field.name} className='text-xs'>
                              {t('attendanceAdmin.shiftBreakStart')}
                            </Label>
                            <Input
                              id={field.name}
                              name={field.name}
                              type='time'
                              value={field.state.value ?? ''}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                          </div>
                        )}
                      </form.AppField>
                      <form.AppField name='breakEnd'>
                        {(field) => (
                          <div className='space-y-1'>
                            <Label htmlFor={field.name} className='text-xs'>
                              {t('attendanceAdmin.shiftBreakEnd')}
                            </Label>
                            <Input
                              id={field.name}
                              name={field.name}
                              type='time'
                              value={field.state.value ?? ''}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                          </div>
                        )}
                      </form.AppField>
                      <form.AppField name='maxBreakMinutes'>
                        {(field) => (
                          <div className='space-y-1'>
                            <Label htmlFor={field.name} className='text-xs'>
                              {t('attendanceAdmin.shiftMaxBreakMinutes')}
                            </Label>
                            <Input
                              id={field.name}
                              name={field.name}
                              type='number'
                              min={0}
                              value={field.state.value ?? ''}
                              onChange={(e) => field.handleChange(e.target.value)}
                            />
                          </div>
                        )}
                      </form.AppField>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label>{t('attendanceAdmin.shiftColor')}</Label>
                    <ColorPalette
                      value={form.getFieldValue('color') ?? null}
                      onChange={(hex) => form.setFieldValue('color', hex)}
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <form.AppField name='lateToleranceMinutes'>
                      {(field) => (
                        <div className='space-y-2'>
                          <Label htmlFor={field.name}>
                            {t('attendanceAdmin.shiftLateTolerance')}
                          </Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            type='number'
                            min={0}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          <FieldError meta={field.state.meta} />
                        </div>
                      )}
                    </form.AppField>
                    <form.AppField name='absenceCutoffMinutes'>
                      {(field) => (
                        <div className='space-y-2'>
                          <Label htmlFor={field.name}>
                            {t('attendanceAdmin.shiftAbsenceCutoff')}
                          </Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            type='number'
                            min={0}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          <FieldError meta={field.state.meta} />
                        </div>
                      )}
                    </form.AppField>
                  </div>

                  <form.AppField name='note'>
                    {(field) => (
                      <div className='space-y-2'>
                        <Label htmlFor={field.name}>{t('attendanceAdmin.shiftNote')}</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value ?? ''}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={t('attendanceAdmin.shiftNotePlaceholder')}
                        />
                      </div>
                    )}
                  </form.AppField>

                  {isEdit && (
                    <form.AppField name='status'>
                      {(field) => (
                        <div className='flex items-start gap-3 rounded-md border p-3'>
                          <Switch
                            id={field.name}
                            checked={field.state.value === 'active'}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked ? 'active' : 'inactive')
                            }
                          />
                          <div>
                            <Label htmlFor={field.name} className='cursor-pointer'>
                              {t('attendanceAdmin.shiftActive')}
                            </Label>
                            <p className='text-muted-foreground text-xs'>
                              {t('attendanceAdmin.shiftActiveDescription')}
                            </p>
                          </div>
                        </div>
                      )}
                    </form.AppField>
                  )}
                </div>

                <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type='button'
                      className='hover:bg-accent flex w-full items-center gap-2 rounded-md border p-2 text-sm font-medium'
                    >
                      {rulesOpen ? (
                        <ChevronDown className='size-4' />
                      ) : (
                        <ChevronRight className='size-4' />
                      )}
                      {t('attendanceAdmin.shiftWeekdayRulesTitle')}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className='mt-2 space-y-2'>
                    <p className='text-muted-foreground text-xs'>
                      {t('attendanceAdmin.shiftWeekdayRulesDescription')}
                    </p>
                    {form
                      .getFieldValue('weekdayRules')
                      .map((rule: ShiftWeekdayRuleFormValues, i: number) => (
                        <div
                          key={rule.dayOfWeek}
                          className='flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm'
                        >
                          <label className='flex w-20 items-center gap-2'>
                            <Checkbox
                              checked={rule.isWorkingDay}
                              onCheckedChange={(checked) => setRule(i, { isWorkingDay: !!checked })}
                            />
                            <span className='text-sm'>{t(DAY_KEYS[rule.dayOfWeek])}</span>
                          </label>
                          <Input
                            type='time'
                            className='h-8 w-28'
                            value={rule.startTime}
                            onChange={(e) => setRule(i, { startTime: e.target.value })}
                            disabled={!rule.isWorkingDay}
                            aria-label={`${t(DAY_KEYS[rule.dayOfWeek])} ${t('attendanceAdmin.shiftDayStart')}`}
                          />
                          <Input
                            type='time'
                            className='h-8 w-28'
                            value={rule.endTime}
                            onChange={(e) => setRule(i, { endTime: e.target.value })}
                            disabled={!rule.isWorkingDay}
                            aria-label={`${t(DAY_KEYS[rule.dayOfWeek])} ${t('attendanceAdmin.shiftDayEnd')}`}
                          />
                        </div>
                      ))}
                  </CollapsibleContent>
                </Collapsible>
              </form.Form>
            </form.AppForm>
          )}
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type='submit' form='shift-form-sheet' isLoading={isPending} disabled={!loaded}>
            <Icons.check /> {isEdit ? t('common.update') : t('common.create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FieldError({ meta }: { meta: { errors: unknown[] } }) {
  const err = meta.errors[0];
  if (!err) return null;
  const message = typeof err === 'string' ? err : (err as { message?: string })?.message;
  return <p className='text-destructive text-xs'>{message ?? String(err)}</p>;
}

function ColorPalette({
  value,
  onChange
}: {
  value: string | null;
  onChange: (hex: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className='flex flex-wrap gap-2'>
      <button
        type='button'
        onClick={() => onChange(null)}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md border-2 text-xs',
          value === null ? 'border-foreground' : 'border-muted hover:border-muted-foreground'
        )}
        aria-label={t('attendanceAdmin.shiftColorNone')}
        title={t('attendanceAdmin.shiftColorNone')}
      >
        {t('attendanceAdmin.shiftColorNoneMark')}
      </button>
      {SHIFT_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.hex}
          type='button'
          onClick={() => onChange(preset.hex)}
          className={cn(
            'h-7 w-7 rounded-md border-2 transition-transform',
            value === preset.hex
              ? 'border-foreground scale-110'
              : 'border-transparent hover:scale-105'
          )}
          style={{ background: preset.hex }}
          aria-label={preset.label}
          title={preset.label}
        />
      ))}
    </div>
  );
}

interface LoadedShift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  max_break_minutes: number | null;
  color: string | null;
  note: string | null;
  late_tolerance_minutes: number;
  absence_cutoff_minutes: number;
  status: 'active' | 'inactive' | null;
}

interface LoadedWeekdayRule {
  day_of_week: number;
  is_working_day: boolean | null;
  start_time: string | null;
  end_time: string | null;
}

function toFormValues(shift: LoadedShift, weekdayRules: LoadedWeekdayRule[]): ShiftFormValues {
  const rulesByDay = new Map(weekdayRules.map((r) => [r.day_of_week, r]));
  return {
    name: shift.name,
    startTime: shift.start_time,
    endTime: shift.end_time,
    breakStart: shift.break_start ?? '',
    breakEnd: shift.break_end ?? '',
    maxBreakMinutes: shift.max_break_minutes != null ? String(shift.max_break_minutes) : '',
    color: shift.color ?? null,
    note: shift.note ?? '',
    lateToleranceMinutes: String(shift.late_tolerance_minutes),
    absenceCutoffMinutes: String(shift.absence_cutoff_minutes),
    status: shift.status ?? 'active',
    weekdayRules: ALL_DAYS.map((dayOfWeek) => {
      const r = rulesByDay.get(dayOfWeek);
      return {
        dayOfWeek,
        isWorkingDay: r?.is_working_day ?? false,
        startTime: r?.start_time ?? shift.start_time,
        endTime: r?.end_time ?? shift.end_time
      };
    })
  };
}

/**
 * Cell popover for the admin schedule grid (ticket 02).
 *
 * Opens on click of a single grid cell. Surfaces:
 *  - Shift dropdown filtered to shifts with `shift_weekday_rules` for this
 *    day-of-week.
 *  - "Day Off" toggle + reason input.
 *  - "Clear" button (visible only when the cell has an existing override
 *    or day-off).
 *  - "Terapkan ke 7 hari minggu ini" toggle (single-day mode only).
 *  - Day-off-pre-existing conflict UX with a "Clear Day Off" button.
 *  - Weekend override note (when the chosen shift has no weekday rule for
 *    the date).
 *  - Policy-missing warning (when the cell was rendered as "—" because
 *    the effective shift has no `shift_policies` row).
 *  - Orphan Day-Off note (when the cell already has a `day_offs` row,
 *    even if the chosen mode is a shift).
 *  - Past-date toast on success.
 *
 * Mutations follow the repo's `mergeMutationCallbacks` pattern with
 * `invalidateQueries` rollback + `onSettled` invalidation
 * (`src/lib/mutation-options.ts:8-34`).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { businessDateInTimeZone } from '@/lib/dates';
import { cn } from '@/lib/utils';

import type { ScheduleGridCell as GridCellData } from '../api/types';
import { addDays, dayOfWeek } from '../utils/date-utils';
import {
  useApplyToWholeWeek,
  useClearCell,
  useSetCellDayOff,
  useSetCellShift
} from '../api/write-mutations';
import { useEligibleShiftsForDay } from '../api/shifts-queries';

export type CellPopoverProps = {
  employeeId: string;
  cell: GridCellData;
  /** Render slot for the cell content (so click-target is the existing cell UI). */
  children: React.ReactNode;
};

/**
 * Format a "Mon 2026-08-03" header label for the popover. Reuses the
 * `attendance.weekXxx` translations for the weekday name.
 */
function formatDateHeading(date: string, t: (key: string) => string): string {
  const dow = dayOfWeek(date);
  const weekdayKeys = [
    'attendance.weekSun',
    'attendance.weekMon',
    'attendance.weekTue',
    'attendance.weekWed',
    'attendance.weekThu',
    'attendance.weekFri',
    'attendance.weekSat'
  ];
  return `${t(weekdayKeys[dow]!)} · ${date}`;
}

export function CellPopover({ employeeId, cell, children }: CellPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [shiftId, setShiftId] = useState<string>(
    cell.shiftId != null ? String(cell.shiftId) : ''
  );
  const [isDayOffToggle, setIsDayOffToggle] = useState<boolean>(cell.isDayOff);
  const [dayOffReason, setDayOffReason] = useState<string>(cell.dayOffReason ?? '');
  const [applyToWeek, setApplyToWeek] = useState<boolean>(false);

  const today = businessDateInTimeZone(new Date());
  const isPastDate = cell.date < today;

  const setShiftMut = useSetCellShift();
  const setDayOffMut = useSetCellDayOff();
  const clearMut = useClearCell();
  const applyWeekMut = useApplyToWholeWeek();

  // Fetch shifts eligible for this cell's day-of-week.
  const { data: dayShifts = [] } = useEligibleShiftsForDay(dayOfWeek(cell.date));

  // Pre-compute the week dates for the bulk toggle.
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i += 1) weekDates.push(addDays(cell.date, -dayOfWeek(cell.date) + i));

  // Apply-to-week is gated server-side by `applyToWholeWeekFn` (which
  // deletes any existing override/day-off per day and skips weekends per
  // `WEEKEND_DAYS`). The client only disables the toggle when no shift is
  // selected.
  const applyToWeekEligible = isDayOffToggle || !!shiftId;

  const isConflict = cell.isDayOff;
  const hasOverrideOrDayOff = cell.isDayOff || cell.shiftId != null;

  // Past-date toast helper — fires on any successful save.
  const firePastDateToast = () => {
    if (isPastDate) toast.info(t('scheduleGrid.popover.pastDateNotice'));
  };

  const handleSaveShift = async () => {
    if (!shiftId) return;
    if (applyToWeek) {
      const res = await applyWeekMut.mutateAsync({
        userId: employeeId,
        weekStart: weekDates[0]!,
        mode: 'shift',
        shiftId: Number(shiftId),
        includeWeekend: true
      });
      if (res.success) {
        if (res.partialFailures.length > 0) {
          toast.warning(
            t('scheduleGrid.popover.bulkPartial', {
              count: res.daysApplied,
              total: res.partialFailures.length
            })
          );
        } else {
          toast.success(t('scheduleGrid.popover.bulkSuccess', { count: res.daysApplied }));
        }
        firePastDateToast();
        setOpen(false);
      } else {
        toast.error(t('scheduleGrid.popover.saveFailed'));
      }
      return;
    }
    const res = await setShiftMut.mutateAsync({
      userId: employeeId,
      date: cell.date,
      shiftId: Number(shiftId)
    });
    if (res.success) {
      toast.success(t('scheduleGrid.popover.shiftSaved'));
      firePastDateToast();
      setOpen(false);
    } else {
      toast.error(t('scheduleGrid.popover.saveFailed'));
    }
  };

  const handleSaveDayOff = async () => {
    const trimmedReason = dayOffReason.trim();
    if (applyToWeek) {
      const res = await applyWeekMut.mutateAsync({
        userId: employeeId,
        weekStart: weekDates[0]!,
        mode: 'dayOff',
        reason: trimmedReason.length > 0 ? trimmedReason : undefined,
        includeWeekend: true
      });
      if (res.success) {
        if (res.partialFailures.length > 0) {
          toast.warning(
            t('scheduleGrid.popover.bulkPartial', {
              count: res.daysApplied,
              total: res.partialFailures.length
            })
          );
        } else {
          toast.success(t('scheduleGrid.popover.bulkSuccess', { count: res.daysApplied }));
        }
        firePastDateToast();
        setOpen(false);
      } else {
        toast.error(t('scheduleGrid.popover.saveFailed'));
      }
      return;
    }
    const res = await setDayOffMut.mutateAsync({
      userId: employeeId,
      date: cell.date,
      reason: trimmedReason.length > 0 ? trimmedReason : undefined
    });
    if (res.success) {
      toast.success(t('scheduleGrid.popover.dayOffSaved'));
      firePastDateToast();
      setOpen(false);
    } else {
      toast.error(t('scheduleGrid.popover.saveFailed'));
    }
  };

  const handleClear = async () => {
    const res = await clearMut.mutateAsync({
      userId: employeeId,
      date: cell.date
    });
    if (res.success) {
      toast.success(t('scheduleGrid.popover.cleared'));
      firePastDateToast();
      setOpen(false);
    } else {
      toast.error(t('scheduleGrid.popover.saveFailed'));
    }
  };

  const isPending =
    setShiftMut.isPending ||
    setDayOffMut.isPending ||
    clearMut.isPending ||
    applyWeekMut.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={t('scheduleGrid.popover.openAria', { date: cell.date })}
          data-testid={`schedule-grid-cell-trigger-${employeeId}-${cell.date}`}
          className='block h-full w-full cursor-pointer text-left'
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side='bottom'
        sideOffset={6}
        className='w-80 space-y-3 p-3'
        data-testid={`schedule-grid-cell-popover-${employeeId}-${cell.date}`}
      >
        <header className='space-y-1'>
          <p className='text-sm font-semibold'>{t('scheduleGrid.popover.title')}</p>
          <p className='text-xs text-muted-foreground'>{formatDateHeading(cell.date, t)}</p>
        </header>

        {/* Policy-missing warning — admin is GOD MODE; non-blocking */}
        {cell.policyMissing ? (
          <div
            role='alert'
            data-testid='policy-missing-warning'
            className='rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300'
          >
            {t('scheduleGrid.popover.policyMissingWarning')}
          </div>
        ) : null}

        {/* Day-off pre-existing conflict — Shift picker disabled until clear */}
        {isConflict ? (
          <div
            role='alert'
            data-testid='day-off-conflict-warning'
            className='rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-700 dark:text-rose-300'
          >
            <p>{t('scheduleGrid.popover.dayOffConflictWarning')}</p>
            <Button
              size='sm'
              variant='outline'
              className='mt-2'
              onClick={handleClear}
              disabled={isPending}
              data-testid='clear-cell-button'
            >
              {t('scheduleGrid.popover.clear')}
            </Button>
          </div>
        ) : null}

        {/* Orphan Day-Off note — visible whenever a day_offs row exists */}
        {isConflict ? (
          <p className='text-[11px] italic text-muted-foreground' data-testid='conflict-day-off-note'>
            {t('scheduleGrid.popover.orphanDayOffNote')}
          </p>
        ) : null}

        {/* Shift selector */}
        <div className='space-y-1'>
          <Label htmlFor={`shift-${employeeId}-${cell.date}`}>{t('scheduleGrid.popover.shift')}</Label>
          <Select value={shiftId} onValueChange={setShiftId} disabled={isConflict}>
            <SelectTrigger
              id={`shift-${employeeId}-${cell.date}`}
              data-testid='shift-select-trigger'
              className='w-full'
            >
              <SelectValue placeholder={t('scheduleGrid.popover.shiftPickerEmpty')} />
            </SelectTrigger>
            <SelectContent>
              {dayShifts.length === 0 ? (
                <div className='px-2 py-1.5 text-xs text-muted-foreground'>
                  {t('scheduleGrid.popover.shiftPickerEmpty')}
                </div>
              ) : (
                dayShifts.map((s) => (
                  <SelectItem
                    key={s.shiftId}
                    value={String(s.shiftId)}
                    data-testid={`shift-option-${s.shiftId}`}
                  >
                    {t('scheduleGrid.popover.shiftOptionLabel', {
                      name: s.shiftName,
                      start: s.startTime,
                      end: s.endTime,
                      tolerance: s.lateToleranceMinutes,
                      cutoff: s.absenceCutoffMinutes
                    })}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Weekend override note — when the cell's day has no weekday rule */}
        {shiftId && !dayShifts.some((s) => String(s.shiftId) === shiftId) ? (
          <p className='text-[11px] italic text-muted-foreground' data-testid='weekend-override-note'>
            {t('scheduleGrid.popover.weekendOverrideNote')}
          </p>
        ) : null}

        {/* Day Off toggle */}
        <div className='flex items-center justify-between gap-2'>
          <Label htmlFor={`dayoff-${employeeId}-${cell.date}`} className='text-sm'>
            {t('scheduleGrid.popover.dayOff')}
          </Label>
          <Switch
            id={`dayoff-${employeeId}-${cell.date}`}
            checked={isDayOffToggle}
            onCheckedChange={setIsDayOffToggle}
            data-testid='day-off-switch'
          />
        </div>
        {isDayOffToggle ? (
          <div className='space-y-1'>
            <Label htmlFor={`reason-${employeeId}-${cell.date}`} className='text-xs'>
              {t('scheduleGrid.popover.dayOffReason')}
            </Label>
            <Input
              id={`reason-${employeeId}-${cell.date}`}
              value={dayOffReason}
              onChange={(e) => setDayOffReason(e.target.value)}
              placeholder={t('scheduleGrid.popover.dayOffReasonPlaceholder')}
              data-testid='day-off-reason-input'
            />
          </div>
        ) : null}

        {/* Apply to week toggle — only single-day mode; disabled if shift lacks rules for any day */}
        <div className='flex items-center justify-between gap-2 border-t pt-2'>
          <Label htmlFor={`apply-week-${employeeId}-${cell.date}`} className='text-xs'>
            {t('scheduleGrid.popover.applyToWeek')}
          </Label>
          <Switch
            id={`apply-week-${employeeId}-${cell.date}`}
            checked={applyToWeek}
            onCheckedChange={setApplyToWeek}
            disabled={!applyToWeekEligible || (isDayOffToggle ? false : !shiftId)}
            data-testid='apply-to-week-switch'
          />
        </div>
        {!applyToWeekEligible && shiftId ? (
          <p className='text-[11px] italic text-rose-600 dark:text-rose-400'>
            {t('scheduleGrid.popover.applyToWeekDisabled')}
          </p>
        ) : null}

        {/* Clear button — only when there's something to clear AND the
            cell is not in the day-off conflict UX (that has its own button). */}
        {hasOverrideOrDayOff && !applyToWeek && !isConflict ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleClear}
            disabled={isPending}
            className={cn('w-full')}
            data-testid='clear-cell-footer-button'
          >
            {t('scheduleGrid.popover.clear')}
          </Button>
        ) : null}

        {/* Action footer */}
        <div className='flex items-center justify-end gap-2 border-t pt-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={isDayOffToggle ? handleSaveDayOff : handleSaveShift}
            disabled={isPending || (!isDayOffToggle && !shiftId)}
            data-testid='popover-save-button'
          >
            {t('scheduleGrid.popover.save')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


/**
 * Row-header "Clear week" action for the admin schedule grid.
 *
 * Owns the destructive button + its shared `ConfirmDialog` and the
 * `useClearWeek` mutation, so the row header stays a thin presentational
 * shell (it just mounts this beside the "+ Assign Shift" CTA / shift pill).
 *
 * Visibility: rendered only when at least one of the visible week's cells is
 * backed by something clearable (`isDayOff` / `hasOverride` / `hasAssignment`).
 * The orphan day-off that motivates this action resolves with `isDayOff: true`
 * and no assignment, so it is always detected — while a week with no data
 * never shows a do-nothing button.
 *
 * UX: the confirm names the employee and the exact YYYY-MM-DD range; a clear
 * that removed nothing is an info toast (not an error), mirroring the
 * popover's "already removed" handling. Errors show the generic failure copy.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icons } from '@/components/icons';
import { businessDateInTimeZone } from '@/lib/dates';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canAttendanceAdminAction } from '@/features/attendance/components/permissions';

import type { ScheduleGridRow as GridRow } from '../api/types';
import { useClearWeek } from '../api/write-mutations';
import { addDays } from '../utils/date-utils';

export type ClearWeekButtonProps = {
  row: GridRow;
  /** Anchor of the currently displayed week (YYYY-MM-DD). */
  weekStart: string;
};

export function ClearWeekButton({ row, weekStart }: ClearWeekButtonProps) {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canDelete = canAttendanceAdminAction(permissions, isAdmin, 'delete');
  const [open, setOpen] = useState(false);
  const clearWeekMut = useClearWeek();
  const weekEnd = addDays(weekStart, 6);

  const hasClearable = row.cells.some(
    (cell) => cell.isDayOff || cell.hasOverride || cell.hasAssignment
  );
  if (!hasClearable || !canDelete) return null;

  // Reuse the popover's past-date notice cheaply: only fire it after a real
  // clear on a fully past week (no new gate, just the existing copy).
  const isPastWeek = weekEnd < businessDateInTimeZone(new Date());

  const handleConfirm = async () => {
    const res = await clearWeekMut.mutateAsync({ userId: row.userId, weekStart });
    if (!res.success) {
      toast.error(t('scheduleGrid.clearWeek.failed'));
      return;
    }
    if (res.totalCleared === 0) {
      toast.info(t('scheduleGrid.clearWeek.nothingToClear', { name: row.fullName }));
      setOpen(false);
      return;
    }
    toast.success(
      t('scheduleGrid.clearWeek.success', { name: row.fullName, count: res.totalCleared })
    );
    if (isPastWeek) toast.info(t('scheduleGrid.popover.pastDateNotice'));
    setOpen(false);
  };

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => setOpen(true)}
        disabled={clearWeekMut.isPending}
        aria-label={t('scheduleGrid.clearWeek.buttonAria', { name: row.fullName })}
        className='h-7 w-7 shrink-0 border-destructive/40 p-0 text-destructive hover:bg-destructive/10'
        data-testid={`clear-week-button-${row.userId}`}
      >
        <Icons.trash className='h-3 w-3' />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        loading={clearWeekMut.isPending}
        title={t('scheduleGrid.clearWeek.title', { name: row.fullName })}
        description={t('scheduleGrid.clearWeek.body', {
          name: row.fullName,
          from: weekStart,
          to: weekEnd
        })}
        confirmLabel={t('scheduleGrid.clearWeek.confirm')}
        onConfirm={handleConfirm}
      />
    </>
  );
}

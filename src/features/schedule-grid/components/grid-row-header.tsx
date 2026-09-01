import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { ScheduleGridRow as GridRow } from '../api/types';
import { buildRowHeaderAriaLabel } from '../utils/aria';

export type GridRowHeaderProps = {
  row: GridRow;
  /** Sticky to the left of the horizontal scroll container. */
  sticky?: boolean;
  /**
   * Ticket 03: invoked when the admin clicks "+ Assign Shift". Only relevant
   * when `row.hasAssignment === false`. The page-level callback is expected
   * to open the `AssignShiftDialog` for the row's user.
   */
  onAssignShift?: (row: GridRow) => void;
};

/**
 * Employee identity column for one row. Sticky on the left so the rest
 * of the row can scroll horizontally on narrow screens while the name
 * stays visible.
 *
 * Ticket 04: `role="rowheader"` + `aria-label` follow the spec rule that
 * the employee column announces name + code + division to screen readers.
 */
export function GridRowHeader({ row, sticky = true, onAssignShift }: GridRowHeaderProps) {
  const { t } = useTranslation();
  const showAssignCta = row.hasAssignment === false && typeof onAssignShift === 'function';
  const rowHeaderAriaLabel = buildRowHeaderAriaLabel(row);
  return (
    <div
      role='rowheader'
      aria-label={rowHeaderAriaLabel}
      className={cn(
        'flex min-h-[3.25rem] items-center gap-2 border-r bg-background px-3 py-2',
        sticky && 'sticky left-0 z-10'
      )}
    >
      <div className='flex min-w-0 flex-col'>
        <span className='truncate text-sm font-medium'>{row.fullName}</span>
        <span className='truncate text-[11px] text-muted-foreground tabular-nums'>
          {row.employeeCode}
          {row.divisionName ? ` · ${row.divisionName}` : ''}
        </span>
        {showAssignCta ? (
          <span className='mt-0.5 text-[10px] text-muted-foreground/70'>
            {t('scheduleGrid.row.unassigned')}
          </span>
        ) : null}
      </div>
      {showAssignCta ? (
        <Button
          size='sm'
          variant='outline'
          className='ml-auto h-7 shrink-0 px-2 text-[11px]'
          onClick={() => onAssignShift(row)}
          data-testid={`assign-shift-cta-${row.userId}`}
        >
          <Icons.add className='mr-1 h-3 w-3' />
          {t('scheduleGrid.row.assignCta')}
        </Button>
      ) : row.activeShiftName ? (
        <span className='ml-auto shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary'>
          {row.activeShiftName}
        </span>
      ) : (
        <span className='ml-auto shrink-0 text-[10px] text-muted-foreground/70'>
          {t('scheduleGrid.rowHeader.noAssignment')}
        </span>
      )}
    </div>
  );
}

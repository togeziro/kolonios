import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ScheduleGridCell as GridCellData } from '../api/types';
import { getCellIdentityKey } from '../utils/cell-identity';
import { buildCellAriaLabel } from '../utils/aria';
import { WEEKEND_DAYS } from '../utils/constants';
import { dayOfWeek } from '../utils/date-utils';
import { CellPopover } from './cell-popover';

/**
 * Single grid cell rendering the resolved schedule for one (employee, date)
 * pair. Three shapes:
 *  - Resolved shift: name + start–end hours
 *  - Day Off: pill with optional reason
 *  - "—" placeholder when the employee has no `schedule_assignments` on
 *    that date (the row header will show the "+ Assign Shift" CTA in
 *    ticket 03, but this cell renders neutrally for ticket 01).
 *
 * For ticket 02, when the cell has an active `schedule_assignments` row
 * for the employee, the cell content is wrapped in `CellPopover` so a
 * click opens the per-cell write popover.
 *
 * Ticket 04: every cell renders an `aria-label` derived from the cell
 * fields directly via `buildCellAriaLabel` (the locked "date + cell state"
 * rule). The label is locale-independent — see `utils/aria.ts`.
 */
export function GridCell({ employeeId, cell }: { employeeId: string; cell: GridCellData }) {
  const { t } = useTranslation();

  const isWeekend = WEEKEND_DAYS.includes(dayOfWeek(cell.date) as (typeof WEEKEND_DAYS)[number]);
  const cellAriaLabel = buildCellAriaLabel(cell);

  const inner = (() => {
    if (cell.isDayOff) {
      return (
        <div
          className={cn(
            'flex h-full min-h-[3.25rem] flex-col items-center justify-center rounded-md border bg-muted px-2 py-1 text-center',
            isWeekend && 'border-dashed'
          )}
          title={cell.dayOffReason ?? t('scheduleGrid.cell.dayOff')}
          aria-label={cellAriaLabel}
        >
          <span className='text-xs font-medium text-muted-foreground'>
            {t('scheduleGrid.cell.dayOff')}
          </span>
          {cell.dayOffReason ? (
            <span className='mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70'>
              {cell.dayOffReason}
            </span>
          ) : null}
        </div>
      );
    }

    if (cell.shiftName && cell.startTime && cell.endTime) {
      return (
        <div
          className={cn(
            'flex h-full min-h-[3.25rem] flex-col items-center justify-center rounded-md border bg-primary/5 px-2 py-1 text-center',
            isWeekend && 'border-dashed'
          )}
          aria-label={cellAriaLabel}
        >
          <span className='line-clamp-1 text-xs font-medium'>{cell.shiftName}</span>
          <span className='mt-0.5 tabular-nums text-[10px] text-muted-foreground'>
            {cell.startTime}
            {t('scheduleGrid.cell.timeSeparator')}
            {cell.endTime}
          </span>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'flex h-full min-h-[3.25rem] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground'
        )}
        aria-label={cellAriaLabel}
      >
        {t('scheduleGrid.cell.placeholder')}
      </div>
    );
  })();

  // Only wrap with the popover when the cell has an active assignment —
  // otherwise ticket 03's row-level "+ Assign Shift" CTA is the
  // intended entry point.
  if (!cell.hasAssignment) {
    return inner;
  }

  // Reset `CellPopover`'s local `useState` whenever the cell's write-tracked
  // identity changes (PRs #112/113 split the integration test because state
  // outlived a save-then-reopen cycle; this `key` makes the popover mount
  // fresh, so a "Clear Day Off" → re-open round-trip shows a clean shift
  // dropdown instead of the prior `isDayOffToggle=true` value). Volatile
  // fields (holiday flags, `policyMissing`) are intentionally excluded so
  // unrelated refetches don't reset mid-edit input.
  // See `.scratch/shift-scheduler/EPIC_SUMMARY.md` § Follow-ups #4.
  return (
    <CellPopover key={getCellIdentityKey(cell)} employeeId={employeeId} cell={cell}>
      {inner}
    </CellPopover>
  );
}

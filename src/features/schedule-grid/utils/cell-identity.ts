/**
 * Cell identity for the schedule grid.
 *
 * `getCellIdentityKey` derives a stable React `key` from the fields of
 * `ScheduleGridCell` that change when the underlying schedule is
 * written. Wrapping a `CellPopover` instance with this key forces a
 * full unmount/remount whenever the cell's state changes server-side
 * (e.g. after `clearCell`, `setCellShift`, or `setCellDayOff`), which
 * resets the popover's local `useState` so the user always sees input
 * fields populated from the latest server truth.
 *
 * The key intentionally excludes volatile read-only fields (holiday
 * flags, `holidayOverUnassigned`) so a holiday-overlay refresh does
 * NOT remount the popover mid-edit. TanStack Query's structural
 * sharing preserves object identity when the cell's relevant fields
 * haven't actually changed, so unrelated background refetches don't
 * cause spurious remounts either.
 *
 * See `.scratch/shift-scheduler/EPIC_SUMMARY.md` § Follow-ups #4 —
 * this is the implementation of that suggestion.
 */

import type { ScheduleGridCell } from '../api/types';

const NULL_MARK = '\u2205'; // ∅ — avoids accidental collisions with the literal string "null"

function field<T>(value: T | null | undefined): T | string {
  return value ?? NULL_MARK;
}

export function getCellIdentityKey(cell: ScheduleGridCell): string {
  return [
    field(cell.shiftId),
    cell.isDayOff ? '1' : '0',
    field(cell.dayOffReason),
    cell.hasAssignment ? '1' : '0'
  ].join('|');
}

/**
 * Aria-label builders for the schedule grid (ticket 04 polish).
 *
 * Per the locked decision in `.scratch/shift-scheduler/spec.md`, every
 * cell's `aria-label` follows the rule "date + cell state" and is bound
 * to the cell's data fields directly — NOT to a translated phrase that
 * varies per locale. This keeps screen-reader output stable across `en`
 * and `id` sessions and avoids the risk of a missing translation breaking
 * the assistive-tech experience.
 */

import type { ScheduleGridCell } from '../api/types';

/**
 * Build the locale-independent aria-label for one cell.
 *
 * - Resolved shift: `<date>, <shiftName> shift, <startTime> to <endTime>`
 * - Day Off: `<date>, day off[, <reason>]`
 * - Placeholder: `<date>, unassigned[, holiday <holidayName>]`
 *
 * The cell's `date` is the canonical YYYY-MM-DD string from the wire
 * shape — already locale-independent. The English literals are deliberate
 * (see file header).
 */
export function buildCellAriaLabel(cell: ScheduleGridCell): string {
  if (cell.isDayOff) {
    const reason = cell.dayOffReason ? `, ${cell.dayOffReason}` : '';
    return `${cell.date}, day off${reason}`;
  }

  if (cell.shiftName && cell.startTime && cell.endTime) {
    return `${cell.date}, ${cell.shiftName} shift, ${cell.startTime} to ${cell.endTime}`;
  }

  if (cell.isHoliday && cell.holidayName) {
    return `${cell.date}, unassigned, holiday ${cell.holidayName}`;
  }

  return `${cell.date}, unassigned`;
}

/**
 * Build the aria-label for an employee row header. Includes the full
 * name, employee code, and division name so screen-reader users can
 * orient themselves without re-reading the visible cell text.
 */
export function buildRowHeaderAriaLabel(row: {
  fullName: string;
  employeeCode: string;
  divisionName: string;
}): string {
  const division = row.divisionName ? `, division ${row.divisionName}` : '';
  return `Employee ${row.fullName}, code ${row.employeeCode}${division}`;
}

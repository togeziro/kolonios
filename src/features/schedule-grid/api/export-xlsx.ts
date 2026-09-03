/**
 * Pure xlsx workbook builder for the schedule-grid month export.
 *
 * Server-only (imports SheetJS). Kept separate from `export-service.ts`
 * so the workbook shape can be unit-tested without a server-fn harness,
 * and so the heavy `xlsx` dependency is only pulled in server-side via the
 * handler's dynamic import (same pattern as
 * `src/features/attendance/api/export-adapter.ts`).
 */

import { utils, write } from 'xlsx';

import { EXPORT_VALUE_UNASSIGNED } from './export-constants';

export const SHIFT_SCHEDULE_SHEET_NAME = 'Shift Schedule';

/** Fixed columns before the per-day columns: `Name | Employee Code | Division`. */
export const SHIFT_SCHEDULE_PRELUDE_COLUMNS = ['Name', 'Employee Code', 'Division'] as const;

export type ShiftScheduleExportRow = {
  fullName: string;
  employeeCode: string;
  divisionName: string;
  /** YYYY-MM-DD -> export value (shift name, OFF, HOLIDAY, or —). */
  cellsByDate: Record<string, string>;
};

/**
 * Build the workbook buffer. Header row 1 is
 * `Name | Employee Code | Division | YYYY-MM-DD ...` (one column per day of
 * the month, in calendar order); each following row is one employee.
 * Values use the grid's vocabulary: the resolved shift name (e.g. `KPI`),
 * `OFF`, `HOLIDAY`, or `—` for unassigned days.
 */
export function buildShiftScheduleWorkbook(
  rows: ShiftScheduleExportRow[],
  dates: string[]
): Buffer {
  const header = [...SHIFT_SCHEDULE_PRELUDE_COLUMNS, ...dates];
  const aoa: string[][] = [header as unknown as string[]];
  for (const row of rows) {
    aoa.push([
      row.fullName,
      row.employeeCode,
      row.divisionName,
      ...dates.map((date) => row.cellsByDate[date] ?? EXPORT_VALUE_UNASSIGNED)
    ]);
  }

  const sheet = utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [
    { wch: 24 }, // Name
    { wch: 14 }, // Employee Code
    { wch: 20 }, // Division
    ...dates.map(() => ({ wch: 12 }))
  ];

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, SHIFT_SCHEDULE_SHEET_NAME);
  return write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

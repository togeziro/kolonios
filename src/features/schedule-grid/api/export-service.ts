/**
 * Month export server fn for the admin schedule grid (ticket 02).
 *
 * Downloads `Shift_Schedule_YYYY-MM.xlsx` with one column per day of the
 * month for the filtered employees (division + search). Values reuse the
 * grid's vocabulary — resolved shift name (e.g. `KPI`), `OFF`, `HOLIDAY`,
 * or `—` — so ticket 04's import can parse the file back without loss.
 *
 * Reads use the same batched per-week engine as `getScheduleGridFn`
 * (`resolveWeekForEmployees`) — no N+1; a 5-week month is ~35 queries,
 * fine for ≤200 rows.
 */

import { createServerFn } from '@tanstack/react-start';
import { asc, inArray } from 'drizzle-orm';
import * as z from 'zod';

import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { departments } from '@/lib/db/schema/masterdata';
import { employees } from '@/lib/db/schema/employees';

import { addDays, daysInMonth, startOfWeek } from '../utils/date-utils';
import { DEFAULT_WEEK_START } from '../utils/constants';
import {
  EXPORT_VALUE_HOLIDAY,
  EXPORT_VALUE_OFF,
  EXPORT_VALUE_UNASSIGNED
} from './export-constants';
import { buildEmployeeWhere, resolveWeekForEmployees, type ScheduleEmployeeRow } from './service';
import type { ScheduleGridCell } from './types';

export const EXPORT_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const;

export const exportMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM'),
  divisionId: z.string().nullable().optional(),
  query: z.string().nullable().optional()
});

export type ExportMonthInput = z.infer<typeof exportMonthSchema>;

export type ExportMonthResult = {
  success: true;
  base64: string;
  filename: string;
  mime: string;
};

/**
 * Map a resolved grid cell to its export value. Mirrors the grid's visible
 * vocabulary: the shift name when one resolves, `OFF` for day offs,
 * `HOLIDAY` for national holidays (incl. over unassigned days), else `—`.
 */
export function cellToExportValue(cell: ScheduleGridCell): string {
  if (cell.shiftName) return cell.shiftName;
  if (cell.isDayOff) return EXPORT_VALUE_OFF;
  if (cell.isHoliday) return EXPORT_VALUE_HOLIDAY;
  return EXPORT_VALUE_UNASSIGNED;
}

/** All YYYY-MM-DD strings inside a month, in calendar order. */
export function datesInMonth(month: string): string[] {
  const count = daysInMonth(month);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(addDays(`${month}-01`, i));
  }
  return out;
}

/**
 * Fetch the filtered employees and resolve every day of the month for each
 * of them, reusing the grid's batched week resolver. Returns rows shaped
 * for the workbook builder.
 */
async function resolveExportRows(input: ExportMonthInput): Promise<
  Array<{
    fullName: string;
    employeeCode: string;
    divisionName: string;
    cellsByDate: Record<string, string>;
  }>
> {
  const divisionId = input.divisionId ? Number(input.divisionId) : null;
  const search = input.query?.trim() ?? null;
  const monthStart = `${input.month}-01`;
  const monthEnd = `${input.month}-${String(daysInMonth(input.month)).padStart(2, '0')}`;
  const dates = datesInMonth(input.month);
  const dateSet = new Set(dates);

  const employeeWhere = buildEmployeeWhere(divisionId, search);
  const employeeRows: ScheduleEmployeeRow[] = await db
    .select({
      id: employees.id,
      employeeCode: employees.employee_code,
      fullName: employees.full_name,
      departmentId: employees.department_id
    })
    .from(employees)
    .where(employeeWhere)
    .orderBy(asc(employees.full_name));

  // No employees match the filter → a header-only workbook is the correct
  // export; skip the per-week resolution entirely.
  if (employeeRows.length === 0) return [];

  const deptIds = Array.from(
    new Set(employeeRows.map((e) => e.departmentId).filter((id): id is number => id != null))
  );
  const deptRows =
    deptIds.length > 0
      ? await db
          .select({ id: departments.id, name: departments.name })
          .from(departments)
          .where(inArray(departments.id, deptIds))
      : [];
  const deptNameById = new Map<number, string>(deptRows.map((d) => [d.id, d.name]));

  // Iterate every week that overlaps the month. The week anchor (default
  // Monday) only affects batching, never the exported day columns.
  const cellsByUser = new Map<string, Record<string, string>>();
  for (
    let weekStart = startOfWeek(monthStart, DEFAULT_WEEK_START);
    weekStart <= monthEnd;
    weekStart = addDays(weekStart, 7)
  ) {
    const { rows } = await resolveWeekForEmployees(employeeRows, deptNameById, weekStart);
    for (const row of rows) {
      const byDate = cellsByUser.get(row.userId) ?? {};
      for (const cell of row.cells) {
        if (dateSet.has(cell.date)) {
          byDate[cell.date] = cellToExportValue(cell);
        }
      }
      cellsByUser.set(row.userId, byDate);
    }
  }

  return employeeRows.map((employee) => ({
    fullName: employee.fullName,
    employeeCode: employee.employeeCode,
    divisionName:
      employee.departmentId != null ? (deptNameById.get(employee.departmentId) ?? '') : '',
    cellsByDate: cellsByUser.get(employee.id) ?? {}
  }));
}

export const exportMonthFn = createServerFn({ method: 'GET' })
  .validator(exportMonthSchema)
  .handler(async ({ data }: { data: ExportMonthInput }): Promise<ExportMonthResult> => {
    const session = await requirePermission('attendance_admin', 'view');
    await checkRateLimit(`scheduleGrid:export:${session.user.id}`);

    const rows = await resolveExportRows(data);
    const dates = datesInMonth(data.month);
    const { buildShiftScheduleWorkbook } = await import('./export-xlsx');
    const buffer = buildShiftScheduleWorkbook(rows, dates);
    return {
      success: true,
      base64: buffer.toString('base64'),
      filename: `Shift_Schedule_${data.month}.xlsx`,
      mime: EXPORT_MIME
    };
  });

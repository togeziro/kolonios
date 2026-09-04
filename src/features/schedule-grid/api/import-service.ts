/**
 * Month import server fn for the admin schedule grid (ticket 04).
 *
 * Counterpart of `export-service.ts` / `export-xlsx.ts`. Accepts a
 * `Shift_Schedule_YYYY-MM.xlsx` file (produced by the export or edited
 * manually), parses it with SheetJS, and writes each cell back to
 * `date_overrides` / `day_offs` via per-cell DELETE-then-INSERT
 * transactions (the same orphan guard as `setCellShiftFn`).
 *
 * Vocabulary (normalised case-insensitively after trim):
 *  - `OFF` / `LIBUR` / `DAY OFF` → `day_offs` (reason null)
 *  - `—` / `-` / `HOLIDAY` / empty on HOLIDAY-derived export → clear
 *    (delete both tables, no insert)
 *  - else → `shifts.name` lookup (case-insensitive); on miss a
 *    `partialFailures` entry is recorded and the cell is skipped
 *
 * Partial failures never abort the whole import.
 */

import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import * as z from 'zod';

import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { dateOverrides, dayOffs, shifts } from '@/lib/db/schema/attendance';
import { employees } from '@/lib/db/schema/employees';

import { SHIFT_SCHEDULE_SHEET_NAME } from './export-xlsx';

// 5 MiB raw binary limit — generous for 200 rows × 31 cols; the base64
// envelope is ~33% larger. A single-cell schedule is ~10 KiB; this blocks
// intentional DoS uploads without affecting legitimate use.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMPORT_BYTES * 4) / 3) + 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Machine-readable import failure codes (contract shared with the client
// CSV download; keep in sync with the toast copy in `schedule-grid-page`).
const IMPORT_WRITE_FAILED = 'writeFailed' as const;
const IMPORT_UNKNOWN_SHIFT_CODE = 'unknownShiftCode' as const;
const IMPORT_UNKNOWN_EMPLOYEE = 'unknownEmployee' as const;

export const importMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM'),
  fileBase64: z.string().min(1).max(MAX_BASE64_LENGTH, 'File too large')
});

export type ImportMonthInput = z.infer<typeof importMonthSchema>;

export type ImportErrorCode =
  | typeof IMPORT_WRITE_FAILED
  | typeof IMPORT_UNKNOWN_SHIFT_CODE
  | typeof IMPORT_UNKNOWN_EMPLOYEE;

export type ImportMonthResult = {
  success: true;
  rowsApplied: number;
  cellsApplied: number;
  partialFailures: Array<{
    row: number;
    date: string;
    employeeCode?: string;
    value?: string;
    error: ImportErrorCode;
  }>;
};

function normaliseCellValue(
  raw: string
): { kind: 'dayOff' } | { kind: 'clear' } | { kind: 'shift'; code: string } | { kind: 'skip' } {
  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'skip' };
  // Em dash `—` (U+2014) is the export's unassigned token; normalise plain
  // hyphens as well so a manually-edited file stays forgiving.
  const upper = trimmed.toUpperCase();
  if (upper === 'OFF' || upper === 'LIBUR' || upper === 'DAY OFF') return { kind: 'dayOff' };
  // Em dash `—` (U+2014) is the export's unassigned token — it has no case
  // mapping, so compare `trimmed` directly. Plain hyphens are normalised too
  // so a manually-edited file stays forgiving.
  if (trimmed === '—' || upper === '-' || upper === 'HOLIDAY') return { kind: 'clear' };
  // SheetJS may return numbers when a lone digit shift code is present; keep
  // the trimmed string as the code.
  return { kind: 'shift', code: trimmed };
}

// Drizzle transaction client type (same Parameters<> pattern as
// `PayrollTransaction` in `src/lib/db/payroll.ts`).
type ImportTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ImportCellWrite = { kind: 'clear' } | { kind: 'dayOff' } | { kind: 'shift'; shiftId: number };

/**
 * Single-cell DELETE-then-INSERT (orphan guard mirrors `setCellShiftFn`:
 * delete both tables first so a stale counterpart can never mask the new
 * row, then insert the target row). Shared by the clear/dayOff/shift
 * branches of the import loop.
 */
async function writeImportCell(
  tx: ImportTx,
  userId: string,
  date: string,
  cell: ImportCellWrite,
  actorId: string
): Promise<void> {
  await tx
    .delete(dateOverrides)
    .where(and(eq(dateOverrides.user_id, userId), eq(dateOverrides.date, date)));
  await tx.delete(dayOffs).where(and(eq(dayOffs.user_id, userId), eq(dayOffs.date, date)));
  if (cell.kind === 'dayOff') {
    await tx.insert(dayOffs).values({
      user_id: userId,
      date,
      reason: null,
      created_by: actorId
    });
  } else if (cell.kind === 'shift') {
    await tx.insert(dateOverrides).values({
      user_id: userId,
      date,
      shift_id: cell.shiftId,
      created_by: actorId
    });
  }
}

export const importMonthFn = createServerFn({ method: 'POST' })
  .validator(importMonthSchema)
  .handler(async ({ data }: { data: ImportMonthInput }): Promise<ImportMonthResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`scheduleGrid:import:${session.user.id}`);

    const buffer = Buffer.from(data.fileBase64, 'base64');
    if (buffer.length > MAX_IMPORT_BYTES) {
      throw new Error('File too large');
    }
    if (buffer.length === 0) {
      throw new Error('Empty file');
    }

    // Lazily import SheetJS server-side only (mirrors export dynamic import;
    // keeps the client bundle free of the heavy xlsx dep).
    const { read, utils } = await import('xlsx');
    let workbook: ReturnType<typeof read>;
    try {
      workbook = read(buffer, { type: 'buffer' });
    } catch {
      throw new Error('Invalid Excel file');
    }

    // Prefer the named export sheet; fall back to the first sheet so a
    // manually-created workbook still imports (Kerjoo-compatible behaviour).
    const sheetName = workbook.SheetNames.includes(SHIFT_SCHEDULE_SHEET_NAME)
      ? SHIFT_SCHEDULE_SHEET_NAME
      : workbook.SheetNames[0];
    if (!sheetName || !workbook.Sheets[sheetName]) {
      throw new Error('Sheet not found');
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as string[][];

    if (rows.length === 0 || !rows[0] || rows[0].length < 4) {
      return { success: true, rowsApplied: 0, cellsApplied: 0, partialFailures: [] };
    }

    const header = rows[0].map((cell) => String(cell ?? '').trim());
    // Columns 0..2 are prelude (Name | Employee Code | Division); date cols start at 3.
    const dateColIndexes: number[] = [];
    const dateByCol = new Map<number, string>();
    for (let col = 3; col < header.length; col += 1) {
      const value = header[col];
      if (!DATE_RE.test(value)) continue;
      // Only accept columns that belong to the requested month — keeps a
      // mis-tagged file from writing outside its claimed month.
      if (!value.startsWith(`${data.month}-`)) continue;
      dateColIndexes.push(col);
      dateByCol.set(col, value);
    }

    if (dateColIndexes.length === 0) {
      return { success: true, rowsApplied: 0, cellsApplied: 0, partialFailures: [] };
    }

    // Build lookup maps: employee_code → userId, lower(shift name) → shiftId.
    const [shiftRows, employeeRows] = await Promise.all([
      db.select({ id: shifts.id, name: shifts.name }).from(shifts),
      db.select({ id: employees.id, employeeCode: employees.employee_code }).from(employees)
    ]);
    const shiftIdByLowerName = new Map<string, number>();
    for (const row of shiftRows) {
      const key = row.name.trim().toLowerCase();
      if (!shiftIdByLowerName.has(key)) shiftIdByLowerName.set(key, row.id);
    }
    const userIdByCode = new Map<string, string>();
    for (const row of employeeRows) {
      const key = String(row.employeeCode ?? '')
        .trim()
        .toLowerCase();
      if (key) userIdByCode.set(key, row.id);
    }

    let cellsApplied = 0;
    const appliedRows = new Set<number>();
    const partialFailures: ImportMonthResult['partialFailures'] = [];

    for (let rowIdx = 1; rowIdx < rows.length; rowIdx += 1) {
      const row = rows[rowIdx] ?? [];
      // Employee Code lives in column 1 (the workbook's second column).
      const employeeCodeRaw = String(row[1] ?? '').trim();
      if (!employeeCodeRaw) continue;
      const userId = userIdByCode.get(employeeCodeRaw.toLowerCase());
      const excelRowNumber = rowIdx + 1; // 1-based for user-facing errors

      if (!userId) {
        for (const col of dateColIndexes) {
          const rawCell = String(row[col] ?? '').trim();
          if (rawCell === '') continue;
          // Only surface a failure when the cell carries a non-clear value;
          // clearing against an unknown employee is a no-op.
          const norm = normaliseCellValue(rawCell);
          if (norm.kind === 'skip' || norm.kind === 'clear') continue;
          partialFailures.push({
            row: excelRowNumber,
            date: dateByCol.get(col) ?? '',
            employeeCode: employeeCodeRaw,
            value: rawCell,
            error: IMPORT_UNKNOWN_EMPLOYEE
          });
        }
        continue;
      }

      let rowHadSuccess = false;
      for (const col of dateColIndexes) {
        const date = dateByCol.get(col)!;
        const rawCell = String(row[col] ?? '');
        const normal = normaliseCellValue(rawCell);

        if (normal.kind === 'skip') continue;

        if (normal.kind === 'clear') {
          try {
            await db.transaction(async (tx) => {
              await writeImportCell(tx, userId, date, { kind: 'clear' }, session.user.id);
            });
            cellsApplied += 1;
            rowHadSuccess = true;
          } catch (err) {
            logger.error({ err, userId, date }, '[db:scheduleGrid.importMonth.clear]');
            partialFailures.push({
              row: excelRowNumber,
              date,
              employeeCode: employeeCodeRaw,
              value: rawCell.trim(),
              error: IMPORT_WRITE_FAILED
            });
          }
          continue;
        }

        if (normal.kind === 'dayOff') {
          try {
            await db.transaction(async (tx) => {
              await writeImportCell(tx, userId, date, { kind: 'dayOff' }, session.user.id);
            });
            cellsApplied += 1;
            rowHadSuccess = true;
          } catch (err) {
            logger.error({ err, userId, date }, '[db:scheduleGrid.importMonth.dayOff]');
            partialFailures.push({
              row: excelRowNumber,
              date,
              employeeCode: employeeCodeRaw,
              value: rawCell.trim(),
              error: IMPORT_WRITE_FAILED
            });
          }
          continue;
        }

        // shift lookup (case-insensitive)
        const shiftId = shiftIdByLowerName.get(normal.code.trim().toLowerCase());
        if (shiftId == null) {
          partialFailures.push({
            row: excelRowNumber,
            date,
            employeeCode: employeeCodeRaw,
            value: rawCell.trim(),
            error: IMPORT_UNKNOWN_SHIFT_CODE
          });
          continue;
        }

        try {
          await db.transaction(async (tx) => {
            await writeImportCell(tx, userId, date, { kind: 'shift', shiftId }, session.user.id);
          });
          cellsApplied += 1;
          rowHadSuccess = true;
        } catch (err) {
          logger.error({ err, userId, date, shiftId }, '[db:scheduleGrid.importMonth.shift]');
          partialFailures.push({
            row: excelRowNumber,
            date,
            employeeCode: employeeCodeRaw,
            value: rawCell.trim(),
            error: IMPORT_WRITE_FAILED
          });
        }
      }

      if (rowHadSuccess) appliedRows.add(excelRowNumber);
    }

    return {
      success: true,
      rowsApplied: appliedRows.size,
      cellsApplied,
      partialFailures
    };
  });

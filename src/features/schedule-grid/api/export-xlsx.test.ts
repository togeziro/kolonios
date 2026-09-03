import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildShiftScheduleWorkbook,
  SHIFT_SCHEDULE_PRELUDE_COLUMNS,
  SHIFT_SCHEDULE_SHEET_NAME
} from './export-xlsx';

function readWorkbook(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1
  }) as unknown as string[][];
  return { wb, sheet, rows };
}

describe('buildShiftScheduleWorkbook', () => {
  it('produces a readable xlsx buffer with one sheet named "Shift Schedule"', () => {
    const buffer = buildShiftScheduleWorkbook([], ['2026-09-01', '2026-09-02']);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    const { wb } = readWorkbook(buffer);
    expect(wb.SheetNames).toEqual([SHIFT_SCHEDULE_SHEET_NAME]);
  });

  it('header = Name | Employee Code | Division + one column per day of the month', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03'];
    const { rows } = readWorkbook(buildShiftScheduleWorkbook([], dates));

    expect(rows[0]).toEqual([...SHIFT_SCHEDULE_PRELUDE_COLUMNS, ...dates]);
    expect(rows[0].length).toBe(3 + dates.length);
  });

  it('maps each employee row to the exported cell values (KPI / OFF / HOLIDAY / —)', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03'];
    const { rows } = readWorkbook(
      buildShiftScheduleWorkbook(
        [
          {
            fullName: 'Aldi Pranata',
            employeeCode: 'EMP-0001',
            divisionName: 'Operations',
            cellsByDate: {
              '2026-09-01': 'KPI',
              '2026-09-02': 'OFF',
              '2026-09-03': 'HOLIDAY'
            }
          },
          {
            fullName: 'Bayu Saputra',
            employeeCode: 'EMP-0002',
            divisionName: 'Engineering',
            cellsByDate: {}
          }
        ],
        dates
      )
    );

    expect(rows[1]).toEqual(['Aldi Pranata', 'EMP-0001', 'Operations', 'KPI', 'OFF', 'HOLIDAY']);
    // Missing per-day values fall back to the "—" placeholder.
    expect(rows[2]).toEqual(['Bayu Saputra', 'EMP-0002', 'Engineering', '—', '—', '—']);
  });

  it('handles an empty employee list (header row only)', () => {
    const dates = ['2026-09-01'];
    const { rows } = readWorkbook(buildShiftScheduleWorkbook([], dates));
    expect(rows).toHaveLength(1);
    expect(rows[0].length).toBe(4);
  });
});

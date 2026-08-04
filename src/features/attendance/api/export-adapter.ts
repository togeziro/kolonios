import { utils, write } from 'xlsx';

export function writeXlsxBuffer(rows: Record<string, unknown>[], sheetName = 'Attendance'): Buffer {
  const sheet = utils.json_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, sheetName);
  return write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

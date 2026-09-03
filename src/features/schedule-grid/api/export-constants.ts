/**
 * Export vocabulary shared between the value mapper (`export-service.ts`),
 * the workbook builder (`export-xlsx.ts`), and — later — the ticket-04
 * import parser. These strings are the silent round-trip contract for the
 * `Shift_Schedule_YYYY-MM.xlsx` format; keeping them in one module means a
 * refactor cannot break re-import without a compile error.
 */

export const EXPORT_VALUE_OFF = 'OFF';
export const EXPORT_VALUE_HOLIDAY = 'HOLIDAY';
export const EXPORT_VALUE_UNASSIGNED = '—';

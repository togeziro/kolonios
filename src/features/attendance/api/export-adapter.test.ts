import { describe, expect, it } from 'vitest';
import { writeXlsxBuffer } from './export-adapter';

describe('writeXlsxBuffer', () => {
  it('produces a non-empty xlsx buffer', () => {
    const buf = writeXlsxBuffer(
      [{ date: '2026-08-04', employee: 'A', status: 'present' }],
      'Attendance'
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK'); // ZIP magic
  });

  it('returns an empty buffer for empty rows without crashing', () => {
    const buf = writeXlsxBuffer([]);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});

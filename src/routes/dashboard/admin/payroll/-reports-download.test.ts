import { describe, expect, it } from 'vitest';
import { decodePayrollExport } from './-reports-download';

describe('payroll report downloads', () => {
  it('keeps CSV response text intact while decoding binary exports', () => {
    expect(
      new TextDecoder().decode(decodePayrollExport('employee_id,net_salary', 'identity'))
    ).toBe('employee_id,net_salary');
    expect(decodePayrollExport(btoa('xlsx-bytes'), 'base64')).toEqual(
      new TextEncoder().encode('xlsx-bytes')
    );
  });
});

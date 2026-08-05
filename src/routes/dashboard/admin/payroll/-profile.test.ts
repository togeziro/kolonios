import { describe, expect, it } from 'vitest';
import { profileRecordId } from './profile';

describe('payroll profile additions', () => {
  it('omits identity for new records while preserving existing history identities', () => {
    expect(profileRecordId(undefined)).toBeUndefined();
    expect(profileRecordId(0)).toBeUndefined();
    expect(profileRecordId(12)).toBe(12);
  });
});

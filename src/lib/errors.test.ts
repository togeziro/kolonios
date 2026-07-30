import { describe, it, expect } from 'vitest';
import { DomainError, mapDbError } from './errors';

describe('mapDbError', () => {
  it('rethrows DomainError', () => {
    const original = new DomainError('test', 'TEST_CODE');
    expect(() => mapDbError(original, 'ctx')).toThrow(DomainError);
  });

  it('wraps unknown error in DomainError with INTERNAL_ERROR code', () => {
    expect(() => mapDbError(new Error('boom'), 'ctx')).toThrowError(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });
});

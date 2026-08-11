import { describe, it, expect, vi, afterEach } from 'vitest';
import { DomainError, mapDbError } from './errors';

vi.mock('./logger', () => ({
  logger: { error: vi.fn() }
}));

vi.mock('./sentry', () => ({
  captureError: vi.fn()
}));

vi.mock('./request-id.server', () => ({
  getRequestId: vi.fn()
}));

import { logger } from './logger';
import { captureError } from './sentry';
import { getRequestId } from './request-id.server';

describe('mapDbError', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rethrows DomainError', () => {
    const original = new DomainError('test', 'TEST_CODE');
    expect(() => mapDbError(original, 'ctx')).toThrow(DomainError);
  });

  it('wraps unknown error in DomainError with INTERNAL_ERROR code', () => {
    expect(() => mapDbError(new Error('boom'), 'ctx')).toThrowError(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });

  it('logs the current request id from getRequestId', () => {
    vi.mocked(getRequestId).mockReturnValue('req-123');
    expect(() => mapDbError(new Error('boom'), 'ctx')).toThrow(DomainError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'ctx', requestId: 'req-123' }),
      '[db:ctx]'
    );
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), {
      context: 'ctx',
      requestId: 'req-123'
    });
  });

  it('logs undefined request id when none is available', () => {
    vi.mocked(getRequestId).mockReturnValue(undefined);
    expect(() => mapDbError(new Error('boom'), 'ctx')).toThrow(DomainError);
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), {
      context: 'ctx',
      requestId: ''
    });
  });
});

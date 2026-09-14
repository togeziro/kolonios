import { describe, it, expect, vi, afterEach } from 'vitest';
import { DomainError, getErrorMessage, mapDbError } from './errors';

vi.mock('./logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() }
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

  it('passes expected auth errors through with their code and skips Sentry', () => {
    const authError = Object.assign(new Error('User already exists. Use another email.'), {
      name: 'APIError',
      statusCode: 400,
      body: {
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.'
      }
    });
    expect(() => mapDbError(authError, 'users.createUser')).toThrowError(
      expect.objectContaining({
        name: 'DomainError',
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.'
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'users.createUser',
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
      }),
      expect.stringContaining('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(captureError).not.toHaveBeenCalled();
  });

  it('still sends unknown auth error codes to Sentry', () => {
    const authError = Object.assign(new Error('Something broke.'), {
      name: 'APIError',
      statusCode: 500,
      body: { code: 'SOME_NEW_CODE' }
    });
    expect(() => mapDbError(authError, 'ctx')).toThrowError(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
    expect(captureError).toHaveBeenCalled();
  });
});

describe('getErrorMessage', () => {
  it('returns the message from a DomainError instance', () => {
    expect(
      getErrorMessage(
        new DomainError(
          'Create a new payroll record version with a later effective date.',
          'HISTORICAL_RECORD_IMMUTABLE'
        )
      )
    ).toBe('Create a new payroll record version with a later effective date.');
  });

  it('returns the message from a plain Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns undefined for null and undefined', () => {
    expect(getErrorMessage(null)).toBeUndefined();
    expect(getErrorMessage(undefined)).toBeUndefined();
  });

  it('returns undefined for primitive values', () => {
    expect(getErrorMessage('just a string')).toBeUndefined();
    expect(getErrorMessage(42)).toBeUndefined();
    expect(getErrorMessage(true)).toBeUndefined();
  });

  it('returns undefined for plain objects without a string message', () => {
    expect(getErrorMessage({ message: 123 })).toBeUndefined();
    expect(getErrorMessage({})).toBeUndefined();
    expect(getErrorMessage({ code: 'X' })).toBeUndefined();
  });

  it('returns the message from an object that duck-types an Error', () => {
    expect(getErrorMessage({ message: 'serialized from server' })).toBe('serialized from server');
  });
});

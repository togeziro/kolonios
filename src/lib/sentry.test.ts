import { describe, expect, it } from 'vitest';
import { captureError, initSentry, isSentryEnabled } from './sentry';

describe('initSentry', () => {
  it('no-ops without a DSN', () => {
    expect(() => initSentry()).not.toThrow();
    expect(isSentryEnabled()).toBe(false);
  });
});

describe('captureError', () => {
  it('no-ops while disabled', () => {
    expect(() => captureError(new Error('boom'))).not.toThrow();
  });
});

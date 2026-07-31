import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureError, initSentry, isSentryEnabled } from './sentry';

describe('initSentry', () => {
  beforeEach(() => {
    vi.stubEnv('SENTRY_DSN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInit, mockCaptureException } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCaptureException: vi.fn()
}));

vi.mock('@sentry/tanstackstart-react', () => ({
  init: mockInit,
  captureException: mockCaptureException
}));

describe('initSentry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SENTRY_DSN', '');
    mockInit.mockReset();
    mockCaptureException.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no-ops without a DSN', async () => {
    const { initSentry, isSentryEnabled } = await import('./sentry');
    expect(() => initSentry()).not.toThrow();
    expect(isSentryEnabled()).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializes when a DSN is set and only once', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@ingest.example.com/project');
    const { initSentry } = await import('./sentry');
    initSentry();
    initSentry();
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('does not crash when Sentry.init throws', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@ingest.example.com/project');
    mockInit.mockImplementation(() => {
      throw new Error('network down');
    });
    const { initSentry } = await import('./sentry');
    expect(() => initSentry()).not.toThrow();
  });
});

describe('captureError', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SENTRY_DSN', '');
    mockInit.mockReset();
    mockCaptureException.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no-ops while disabled', async () => {
    const { captureError } = await import('./sentry');
    expect(() => captureError(new Error('boom'))).not.toThrow();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('captures with and without tags once enabled', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@ingest.example.com/project');
    const { initSentry, captureError } = await import('./sentry');
    initSentry();
    captureError(new Error('boom'));
    expect(mockCaptureException).toHaveBeenCalledWith(new Error('boom'), undefined);
    captureError(new Error('boom'), { module: 'auth' });
    expect(mockCaptureException).toHaveBeenCalledWith(new Error('boom'), {
      tags: { module: 'auth' }
    });
  });
});

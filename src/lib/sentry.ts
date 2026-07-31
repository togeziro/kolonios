import * as Sentry from '@sentry/tanstackstart-react';

let enabled = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || enabled) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)
    });
    enabled = true;
  } catch (err) {
    // Never break the app because Sentry misbehaved.
    console.warn('Sentry init failed — continuing without error tracking', err);
  }
}

export function captureError(error: unknown, tags?: Record<string, string>) {
  if (!enabled) return;
  try {
    Sentry.captureException(error, tags ? { tags } : undefined);
  } catch {
    // Capture must never throw into the calling code path.
  }
}

export function isSentryEnabled() {
  return enabled;
}

/**
 * Centralized constants for the application.
 * Use these constants instead of hardcoded magic numbers or strings.
 */

export const AUTH_RATE_LIMIT_DEFAULTS = {
  window: 60, // seconds
  max: 150, // requests per window
  maxSignin: 8 // requests per window for sign-in endpoint
} as const;

export const RATE_LIMIT_DEFAULTS = {
  max: 150, // requests per window
  windowMs: 60000 // milliseconds
} as const;

/**
 * Better Auth minimum password length. Canonical home for this number:
 * features must import it from here (never duplicate the literal), because
 * `src/lib` cannot import from `src/features` (ADR-0001) while the DB layer
 * (`replaceUserPassword` guard) needs the same gate as the UI schemas.
 */
export const MIN_PASSWORD_LENGTH = 8;

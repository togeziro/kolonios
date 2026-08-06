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

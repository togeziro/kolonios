import { createServerFn } from '@tanstack/react-start';
import { isPublicSignupEnabled } from '@/lib/env';

/**
 * Public auth configuration for the sign-in/sign-up pages. No session
 * required — the flag only reveals whether self-registration is open.
 * Enforcement lives server-side in better-auth (`disableSignUp`, see
 * src/lib/auth/auth.server.ts); this getter only drives the UI.
 */
export const getPublicAuthConfigFn = createServerFn({ method: 'GET' }).handler(async () => {
  return { signupEnabled: isPublicSignupEnabled() };
});

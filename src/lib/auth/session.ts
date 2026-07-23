import { createMiddleware, createServerFn } from '@tanstack/react-start';

export async function requireSession() {
  const { auth } = await import('./auth.server');
  const { getRequestHeaders } = await import('@tanstack/react-start/server');
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  return requireSession();
});

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await requireSession();
  return next({
    context: {
      session
    }
  });
});

// `requireRole('user')` is equivalent to `requireSession()` (any authenticated
// user qualifies as a "user"). The `'user'` branch exists for API symmetry and
// is intentionally a no-op beyond session validation.
export async function requireRole(role: 'admin' | 'user') {
  const session = await requireSession();
  if (role === 'admin' && session.user.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return session;
}

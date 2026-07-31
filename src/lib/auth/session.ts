import { createMiddleware, createServerFn } from '@tanstack/react-start';

export type Role = 'admin' | 'hr' | 'employee' | 'technician' | 'customer' | 'user';

const validRoles: Role[] = ['admin', 'hr', 'employee', 'technician', 'customer', 'user'];

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

// Exact-set membership. requireRole('employee') does NOT admit 'technician'
// and vice versa — they are distinct roles with distinct call sites.
// `user` and `customer` pass for any authenticated session (self-service roles).
const roleSets: Record<'admin' | 'hr' | 'employee' | 'technician', Role[]> = {
  admin: ['admin'],
  hr: ['admin', 'hr'],
  employee: ['admin', 'hr', 'employee'],
  technician: ['admin', 'hr', 'technician']
};

export async function requireRole(role: Role) {
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  const session = await requireSession();
  const userRole = session.user.role as Role;
  const set = roleSets[role as keyof typeof roleSets];
  if (set && !set.includes(userRole)) {
    throw new Error(`Forbidden: ${role} access required`);
  }
  return session;
}

// Hierarchical guard: the session user must be AT LEAST `min`.
// Tiers: employee ≡ technician < hr < admin.
// Use requireMinRole('employee') for self-service actions that both
// employees and technicians may perform (e.g. attendance check-in).
const tierOf: Record<Role, number> = {
  employee: 1,
  technician: 1,
  hr: 2,
  admin: 3,
  user: 0,
  customer: 0
};

const tierLabel: Record<number, string> = { 1: 'employee', 2: 'hr', 3: 'admin' };

export async function requireMinRole(min: 'employee' | 'hr' | 'admin') {
  const session = await requireSession();
  const userRole = session.user.role as Role;
  const userTier = tierOf[userRole] ?? 0;
  const minTier = tierOf[min];
  if (userTier < minTier) {
    throw new Error(`Forbidden: ${tierLabel[minTier]} role required`);
  }
  return session;
}

export async function requireAdmin() {
  return requireRole('admin');
}

export async function requireHR() {
  return requireRole('hr');
}

export async function requireEmployee() {
  return requireRole('employee');
}

export async function requireTechnician() {
  return requireRole('technician');
}

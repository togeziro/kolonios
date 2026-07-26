import { createMiddleware, createServerFn } from '@tanstack/react-start';

type Role = 'admin' | 'hr' | 'employee' | 'technician' | 'user';

const validRoles: Role[] = ['admin', 'hr', 'employee', 'technician', 'user'];

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

export async function requireRole(role: Role) {
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  const session = await requireSession();
  const userRole = session.user.role as Role;

  const adminRoles = ['admin'];
  const hrRoles = ['admin', 'hr'];
  const employeeRoles = ['admin', 'hr', 'employee', 'technician'];

  if (role === 'admin' && !adminRoles.includes(userRole)) {
    throw new Error('Forbidden: Admin access required');
  }
  if (role === 'hr' && !hrRoles.includes(userRole)) {
    throw new Error('Forbidden: HR access required');
  }
  if (role === 'employee' && !employeeRoles.includes(userRole)) {
    throw new Error('Forbidden: Employee access required');
  }
  if (role === 'technician' && !employeeRoles.includes(userRole)) {
    throw new Error('Forbidden: Technician access required');
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

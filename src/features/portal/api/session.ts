import { createServerFn } from '@tanstack/react-start';
import { classifyPortalAccess } from '@/lib/portal/access';
import type { PortalAccess } from '@/lib/portal/access';

export const requirePortalSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PortalAccess> => {
    const { requireSession } = await import('@/lib/auth/session');
    const session = await requireSession();
    const { db } = await import('@/lib/db');
    const { customers } = await import('@/lib/db/schema/customers');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ status: customers.status })
      .from(customers)
      .where(eq(customers.id, session.user.id))
      .limit(1);
    return classifyPortalAccess(session.user.role, row?.status);
  }
);

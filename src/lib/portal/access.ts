import { CUSTOMER_ROLE } from '@/lib/shells/config';

export type PortalAccess =
  | { ok: true }
  | { ok: false; reason: 'not_customer' | 'inactive' | 'no_profile' };

export function classifyPortalAccess(
  role: string | null | undefined,
  customerStatus: string | undefined
): PortalAccess {
  if (role !== CUSTOMER_ROLE) return { ok: false, reason: 'not_customer' };
  if (customerStatus === undefined) return { ok: false, reason: 'no_profile' };
  if (customerStatus !== 'active') return { ok: false, reason: 'inactive' };
  return { ok: true };
}

import { BACKOFFICE_ROLE_GROUP_NAMES, CUSTOMER_ROLE, LEGACY_BACKOFFICE_ROLES } from './config';

export type ShellKey = 'backoffice' | 'fieldops' | 'portal';

interface ResolveShellInput {
  role?: string | null;
  roleGroup?: { name: string; is_admin: boolean } | null;
}

export function resolveShell({ role, roleGroup }: ResolveShellInput = {}): ShellKey {
  if (role === CUSTOMER_ROLE) return 'portal';
  if (roleGroup) {
    if (roleGroup.is_admin || BACKOFFICE_ROLE_GROUP_NAMES.includes(roleGroup.name)) {
      return 'backoffice';
    }
    return 'fieldops';
  }
  if (role && LEGACY_BACKOFFICE_ROLES.includes(role)) return 'backoffice';
  return 'fieldops';
}

export function resolveHomePath(role?: string | null): string {
  return role === CUSTOMER_ROLE ? '/portal' : '/dashboard/overview';
}

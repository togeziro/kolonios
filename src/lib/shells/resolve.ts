import {
  BACKOFFICE_ROLE_GROUP_NAMES,
  CUSTOMER_ROLE,
  FIELD_OPS_LEGACY_ROLES,
  FIELD_OPS_ROLE_GROUP_NAMES,
  LEGACY_BACKOFFICE_ROLES
} from './config';

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
    if (FIELD_OPS_ROLE_GROUP_NAMES.includes(roleGroup.name)) {
      return 'fieldops';
    }
    return 'backoffice';
  }
  if (role) {
    if (LEGACY_BACKOFFICE_ROLES.includes(role)) return 'backoffice';
    if (FIELD_OPS_LEGACY_ROLES.includes(role)) return 'fieldops';
  }
  return 'backoffice';
}

export function resolveHomePath(role?: string | null): string {
  return role === CUSTOMER_ROLE ? '/portal' : '/dashboard/overview';
}

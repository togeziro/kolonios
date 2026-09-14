// 'Administrator'/'SPV' are pre-rename legacy names kept so databases that
// have not applied migration 0040 yet still resolve to the right shell.
export const BACKOFFICE_ROLE_GROUP_NAMES: readonly string[] = ['Admin', 'Administrator', 'HR'];
export const LEGACY_BACKOFFICE_ROLES: readonly string[] = ['admin', 'hr'];
export const FIELD_OPS_ROLE_GROUP_NAMES: readonly string[] = ['Technician', 'Operation', 'SPV'];
export const FIELD_OPS_LEGACY_ROLES: readonly string[] = ['technician'];
export const CUSTOMER_ROLE = 'customer' as const;
export const DEFAULT_INTERNAL_HOME = '/dashboard/overview' as const;
export const PORTAL_HOME = '/portal' as const;

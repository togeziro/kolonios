import type { Permissions } from '@/features/role-groups/api/types';

export type PayrollAction = 'view' | 'add' | 'edit' | 'delete' | 'approve' | 'pay' | 'reports';

export function canPayrollAction(
  permissions: Permissions | undefined,
  isAdmin: boolean,
  action: PayrollAction
) {
  return isAdmin || permissions?.payroll?.[action] === true;
}

export function settingsSaveDisabled(canEdit: boolean, isPending: boolean) {
  return !canEdit || isPending;
}

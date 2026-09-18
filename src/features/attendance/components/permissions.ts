import type { Permissions } from '@/features/role-groups/api/types';

export type AttendanceAdminAction = 'view' | 'add' | 'edit' | 'delete' | 'reports';

export function canAttendanceAdminAction(
  permissions: Permissions | undefined,
  isAdmin: boolean,
  action: AttendanceAdminAction
) {
  return isAdmin || permissions?.attendance_admin?.[action] === true;
}

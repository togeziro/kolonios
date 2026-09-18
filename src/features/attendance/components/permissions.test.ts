import { describe, expect, it } from 'vitest';
import { canAttendanceAdminAction } from './permissions';

describe('canAttendanceAdminAction', () => {
  it('grants every action to is_admin groups regardless of stored permissions', () => {
    for (const action of ['view', 'add', 'edit', 'delete', 'reports'] as const) {
      expect(canAttendanceAdminAction({}, true, action)).toBe(true);
    }
  });

  it('reads the attendance_admin key for non-admin groups', () => {
    const permissions = { attendance_admin: { view: true, add: true } };
    expect(canAttendanceAdminAction(permissions, false, 'view')).toBe(true);
    expect(canAttendanceAdminAction(permissions, false, 'add')).toBe(true);
    expect(canAttendanceAdminAction(permissions, false, 'edit')).toBe(false);
    expect(canAttendanceAdminAction(permissions, false, 'delete')).toBe(false);
    expect(canAttendanceAdminAction(permissions, false, 'reports')).toBe(false);
  });

  it('denies everything when the module key is absent or permissions are missing', () => {
    expect(canAttendanceAdminAction({}, false, 'view')).toBe(false);
    expect(canAttendanceAdminAction(undefined, false, 'add')).toBe(false);
  });
});

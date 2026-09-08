export type KeyFolder = 'attendance' | 'customers' | 'tickets' | 'checklists' | 'avatars';

export function parseKeyFolder(key: string): KeyFolder | null {
  const folder = key.split('/')[0];
  return folder === 'attendance' ||
    folder === 'customers' ||
    folder === 'tickets' ||
    folder === 'checklists' ||
    folder === 'avatars'
    ? folder
    : null;
}

/**
 * Ownership check for presigned GET (IDOR guard). The module-level permission
 * check happens in getObjectUrlFn via requirePermission — this helper only
 * decides the ownership dimension:
 * - attendance/ keys: caller may read their own, or any with attendance.edit
 *   (modeled as isAdmin here; the server fn passes true only when it has
 *   already verified attendance.edit).
 * - avatars/ keys: caller may read their own only (profile page self-view).
 * - customers/, tickets/ keys: no per-user ownership (module permission is
 *   the gate).
 */
export function canViewKey(
  key: string,
  userId: string,
  isAdmin: boolean,
  canReviewChecklists = false
): boolean {
  const folder = parseKeyFolder(key);
  if (folder === 'attendance') {
    return isAdmin || key.startsWith(`attendance/${userId}/`);
  }
  if (folder === 'checklists') {
    return canReviewChecklists || key.startsWith(`checklists/${userId}/`);
  }
  if (folder === 'avatars') {
    return key.startsWith(`avatars/${userId}/`);
  }
  return folder === 'customers' || folder === 'tickets';
}

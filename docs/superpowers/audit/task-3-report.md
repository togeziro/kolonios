# Task 3: Unify Admin Bypass Logic - Status Report

## Status: ✅ Completed

## Summary

Successfully unified the admin bypass logic to use `role_groups.is_admin` as the single source of truth for admin authorization, while maintaining backward compatibility during migration.

## Changes Made

### 1. Updated `requirePermission()` in `src/lib/auth/session.ts`

**Before:**
```ts
export async function requirePermission(module: string, action: PermissionAction = 'view') {
  const session = await requireSession();
  if (session.user.role === 'admin') return session;  // Legacy check first
  const group = await loadRoleGroup(session.user.id);
  if (!group) throw new Error(`Forbidden: ${module}.${action} required`);
  if (hasModulePermission(group.permissions, group.is_admin, module, action)) return session;
  throw new Error(`Forbidden: ${module}.${action} required`);
}
```

**After:**
```ts
export async function requirePermission(module: string, action: PermissionAction = 'view') {
  const session = await requireSession();
  const group = await loadRoleGroup(session.user.id);

  // If no role group assigned, deny access
  if (!group) {
    // Check if user.role is admin for backward compatibility during migration
    if (session.user.role === 'admin') {
      console.warn('User has admin role but no role group assignment');
      return session;
    }
    throw new Error(`Forbidden: ${module}.${action} required`);
  }

  // Use role group for authorization
  if (hasModulePermission(group.permissions, group.is_admin, module, action)) {
    return session;
  }

  throw new Error(`Forbidden: ${module}.${action} required`);
}
```

**Key Changes:**
- Removed the early admin role check that was bypassing role group lookup
- Now loads the role group FIRST, then checks permissions
- Added backward compatibility fallback for admin users without role group assignment (with warning)
- Admin bypass now primarily relies on `role_groups.is_admin` field

### 2. Updated Tests in `src/lib/auth/session.test.ts`

**Added/Modified Tests:**
- `passes for a role group with is_admin` - Verifies admin bypass via role group
- `rejects when the user has no role group and is not admin` - Clarified test name
- `passes for legacy admin role without a role group (fallback with warning)` - Updated to verify console.warn is called
- Added `afterEach` import from vitest for proper test cleanup
- Added console.warn spy to verify backward compatibility warning

**Test Results:**
- All 13 tests pass
- Console warning is properly tested for legacy admin fallback

### 3. Verification

- ✅ `bun run typecheck` - Passed
- ✅ `bun run test:run` - All tests pass
- ✅ `bun run lint` - Passed (0 errors)

## Migration Notes

**Temporary Backward Compatibility:**
- Admin users without a role group assignment will still be allowed access
- A console warning is emitted: "User has admin role but no role group assignment"
- This is temporary during migration period

**Next Steps for Full Migration:**
1. Ensure all admin users have a role group with `is_admin: true`
2. Once confirmed, remove the backward compatibility fallback
3. Remove the console.warn and legacy check

## Commit

```
afd0f57 fix: unify admin bypass to use role_groups.is_admin consistently
```

## Files Modified

- `src/lib/auth/session.ts` - Updated `requirePermission()` logic
- `src/lib/auth/session.test.ts` - Updated and added tests

## Related Files Verified

- `src/lib/db/role-groups.ts` - Confirmed `getUserRoleGroup()` exists and returns `is_admin` field
- `src/lib/auth/session.ts:hasModulePermission()` - Already correctly uses `is_admin` parameter

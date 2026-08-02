# Authorization Legacy Usage Audit

**Date:** 2026-08-03  
**Task:** Task 1 - Audit Legacy Authorization Usage  
**Status:** Complete

## Summary

The codebase has **successfully migrated** from legacy role-based authorization helpers to the new permission-based system using `requirePermission(module, action)`. No feature files use the legacy helpers.

## Legacy Helper Definitions

All legacy helpers are defined in `/src/lib/auth/session.ts`:

| Helper | Lines | Description |
|--------|-------|-------------|
| `requireRole(role)` | 73-84 | Exact role membership check |
| `requireMinRole(min)` | 101-110 | Hierarchical role check (tier-based) |
| `requireAdmin()` | 112-114 | Wrapper: `requireRole('admin')` |
| `requireHR()` | 116-118 | Wrapper: `requireRole('hr')` |
| `requireEmployee()` | 120-122 | Wrapper: `requireRole('employee')` |
| `requireTechnician()` | 124-126 | Wrapper: `requireRole('technician')` |

## Files Containing Legacy Helper References

### 1. `/src/lib/auth/session.ts` (DEFINITIONS)
- **Lines 63-126**: Full definitions of all legacy helpers
- **Status**: Can be removed after verification
- **Recommendation**: Safe to remove once Task 2 is executed

### 2. `/src/lib/auth/session.test.ts` (TESTS)
- **Lines 27-34**: Imports of legacy helpers
- **Lines 58-85**: Tests for `requireRole`
- **Lines 91-112**: Tests for `requireMinRole`
- **Lines 117-151**: Tests for edge cases and convenience wrappers
- **Status**: Test coverage for legacy helpers
- **Recommendation**: Remove these tests when legacy helpers are removed

### 3. `/src/lib/auth/permissions.ts` (COMMENT ONLY)
- **Line 3**: Comment mentioning legacy helpers (outdated)
- **Current comment**: `// requireRole/requireMinRole in src/lib/auth/session.ts. Reserved for`
- **Status**: Comment is outdated - features now use `requirePermission`
- **Recommendation**: Update comment to reflect current architecture

## Feature Files Audit

All feature server functions in `/src/features/*/api/service.ts` use `requirePermission(module, action)`:

| Feature | File | Permissions Used |
|---------|------|------------------|
| Audit | `src/features/audit/api/service.ts` | `audit_log:view` |
| Products | `src/features/products/api/service.ts` | `products:view/add/edit/delete` |
| Tasks | `src/features/tasks/api/service.ts` | `my_work:view`, `jobs:view` |
| Role Groups | `src/features/role-groups/api/service.ts` | `role_groups:view/add/edit/delete` |
| Customers | `src/features/customers/api/service.ts` | `customers:view/add/edit/delete` |
| Attendance | `src/features/attendance/api/service.ts` | `attendance:view`, `leave:view` |
| Notifications | `src/features/notifications/api/service.ts` | `notifications:view` |
| Employees | `src/features/employees/api/service.ts` | `employees:view/add/edit/delete` |
| Users | `src/features/users/api/service.ts` | `users:view/add/edit/delete` |
| Masterdata | `src/features/masterdata/api/service.ts` | `departments:view/add/edit/delete`, `designations:view/add/edit/delete` |

**Verification**: ✅ All 10 feature modules use `requirePermission` exclusively

## UI Components Audit

Searched all `.tsx` files for legacy helper usage: **NONE FOUND**

UI components use:
- `useSession()` hook from `better-auth/react`
- `useRoleGroupPermissions()` hook from `@/hooks/use-nav.ts`
- Client-side permission checks via permission maps

## Other Files Audit

Searched all `.ts` and `.tsx` files for imports or usage of legacy helpers: **NONE FOUND**

Only 3 files reference legacy helpers (as listed above).

## Migration Status

| Aspect | Status |
|--------|--------|
| Feature server functions | ✅ Complete - all use `requirePermission` |
| UI components | ✅ Complete - no legacy helper usage |
| Test files | ⚠️ Pending - tests still cover legacy helpers |
| Auth library | ⚠️ Pending - legacy helpers still defined |

## Recommendations

### For Task 2 (Remove Legacy Helpers):

1. **Safe to remove**:
   - All legacy helper definitions in `src/lib/auth/session.ts` (lines 63-126)
   - All legacy helper tests in `src/lib/auth/session.test.ts` (lines 27-34, 58-151)

2. **Update**:
   - Comment in `src/lib/auth/permissions.ts` line 3 to remove outdated reference

3. **Verify**:
   - Run test suite to ensure no regressions
   - Confirm all feature tests still pass with `requirePermission`

### Risk Assessment

- **Low risk**: No feature code depends on legacy helpers
- **No breaking changes**: Removing legacy helpers will not affect functionality
- **Test coverage**: Ensure `requirePermission` is well-tested before removing legacy tests

## Next Steps

1. ✅ Task 1 Complete: Audit finished - legacy helpers are not used in feature code
2. ⏭️ Task 2: Remove legacy helper definitions and tests
3. ⏭️ Task 3: Update documentation and comments

## Appendices

### A. Search Commands Used

```bash
# Search for legacy helper calls
grep -r "requireRole\|requireMinRole\|requireAdmin\|requireHR\|requireEmployee\|requireTechnician" --include="*.ts" --include="*.tsx"

# Search for actual invocations
grep -r "await requireRole\|await requireMinRole\|await requireAdmin\|await requireHR\|await requireEmployee\|await requireTechnician" --include="*.ts" --include="*.tsx"

# Search for requirePermission usage
grep -r "requirePermission" --include="*.ts" --include="*.tsx"
```

### B. File Inventory

**Files with legacy helper definitions**: 1
- `src/lib/auth/session.ts`

**Files with legacy helper tests**: 1
- `src/lib/auth/session.test.ts`

**Files with outdated comments**: 1
- `src/lib/auth/permissions.ts`

**Files using requirePermission**: 10 feature modules
- All files in `src/features/*/api/service.ts`

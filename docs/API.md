# API Documentation

> **Interactive docs:** build once with `bun run api:docs` (or `bun run build`,
> which runs it automatically), then open `/api-docs.html` (spec at
> `/openapi.json`) — a Redoc-rendered OpenAPI 3.1 document generated from the
> same Zod schemas used for runtime validation.

## Server Functions

All server functions are defined in `src/features/<feature>/api/service.ts`
and expose database operations via `createServerFn()`. Handlers use dynamic
imports to prevent the `postgres` driver from leaking into the client bundle.

### RPC boundary guarantees

- **Authentication**: every endpoint calls `requireSession()` at the top of its
  handler (`src/lib/auth/session.ts`), so endpoints cannot be called
  unauthenticated — independent of route guards. Module endpoints add
  `requirePermission(module, action)`, which resolves the caller's role-group
  permission map from the DB.
- **Input validation**: every endpoint uses a Zod schema from
  `src/features/<feature>/api/validation.ts` via `@tanstack/zod-adapter`'s
  `zodValidator` (or `z.coerce` for string→number ids).
- **Error mapping**: `lib/db/*.ts` wraps DB calls in `mapDbError`
  (`src/lib/errors.ts`); intentional errors throw `DomainError` and pass
  through, unexpected errors become a generic message and are logged to
  pino + Sentry with a `request_id` tag.
- **Request correlation**: every handler runs inside
  `withRequestContext(...)` (`src/lib/request-id.ts`); the response carries
  an `x-request-id` header echoed from the client (or generated).

The "Required permission" column uses `<module>.<action>` keys from the
role-group permission matrix (`src/config/nav-config.ts` module keys). The
`admin` role bypasses the matrix. Actions: `view`, `add`, `edit`, `delete`.

### Products

| Function           | Method | Required permission | Payload                  | Returns                |
| ------------------ | ------ | ------------------- | ------------------------ | ---------------------- |
| `getProductsFn`    | GET    | `products.view`     | `ProductFilters`         | `ProductsResponse`     |
| `getProductByIdFn` | GET    | `products.view`     | `number` (id)            | `ProductByIdResponse`  |
| `createProductFn`  | POST   | `products.add`      | `ProductMutationPayload` | `Product`              |
| `updateProductFn`  | POST   | `products.edit`     | `{ id, values }`         | `Product`              |
| `deleteProductFn`  | POST   | `products.delete`   | `number` (id)            | `{ success, message }` |

### Users

| Function       | Method | Required permission | Payload               | Returns                |
| -------------- | ------ | ------------------- | --------------------- | ---------------------- |
| `getUsersFn`   | GET    | `users.view`        | `UserFilters`         | `UsersResponse`        |
| `createUserFn` | POST   | `users.add`         | `UserMutationPayload` | `User` (+ audit)       |
| `updateUserFn` | POST   | `users.edit`        | `{ id, values }`      | `User` (+ audit)       |
| `deleteUserFn` | POST   | `users.delete`      | `number` (id)         | `{ success, message }` (+ audit) |

> `users.*` writes use the Better Auth admin API; the caller's own role-group
> assignment is preserved (never self-demotion).

### Employees

| Function            | Method | Required permission | Payload                     | Returns                |
| ------------------- | ------ | ------------------- | --------------------------- | ---------------------- |
| `listEmployeesFn`   | GET    | `employees.view`    | `EmployeeFilters`           | `EmployeesResponse`    |
| `getEmployeeByIdFn` | GET    | `employees.view`    | `employeeIdSchema` (id)     | `EmployeeByIdResponse` |
| `createEmployeeFn`  | POST   | `employees.add`     | `EmployeeMutationPayload`   | `Employee` (+ audit)   |
| `updateEmployeeFn`  | POST   | `employees.edit`    | `{ id, values }`            | `Employee` (+ audit)   |
| `deleteEmployeeFn`  | POST   | `employees.delete`  | `employeeIdSchema` (id)     | `{ success, message }` (+ audit) |

### Customers

| Function            | Method | Required permission | Payload                     | Returns                |
| ------------------- | ------ | ------------------- | --------------------------- | ---------------------- |
| `listCustomersFn`   | GET    | `customers.view`    | `CustomerFilters`           | `CustomersResponse`    |
| `getCustomerByIdFn` | GET    | `customers.view`    | `customerIdSchema` (id)     | `CustomerByIdResponse` |
| `createCustomerFn`  | POST   | `customers.add`     | `CustomerMutationPayload`   | `Customer` (+ audit)   |
| `updateCustomerFn`  | POST   | `customers.edit`    | `{ id, values }`            | `Customer` (+ audit)   |
| `deleteCustomerFn`  | POST   | `customers.delete`  | `customerIdSchema` (id)     | `{ success, message }` (+ audit) |

### Notifications

| Function               | Method | Required permission | Payload                  | Returns                |
| ---------------------- | ------ | ------------------- | ------------------------ | ---------------------- |
| `getNotificationsFn`   | GET    | `notifications.view`| —                        | `NotificationsResponse`|
| `markAsReadFn`         | POST   | `notifications.view`| `{ id: string }`         | `{ success: boolean }` |
| `markAllAsReadFn`      | POST   | `notifications.view`| —                        | `{ success: boolean }` |
| `addNotificationFn`    | POST   | `notifications.view`| `AddNotificationPayload` | `NotificationItem` (+ audit) |
| `removeNotificationFn` | POST   | `notifications.view`| `{ id: string }`         | `{ success: boolean }` (+ audit) |

> All notification queries are scoped by `user_id` (IDOR-safe).

Polling: the query refetches every 30 s (see `docs/NOTIFICATIONS.md`).

### Attendance — employee self-service

| Function              | Method | Required permission | Payload                         | Returns              |
| --------------------- | ------ | ------------------- | ------------------------------- | -------------------- |
| `checkInFn`           | POST   | `attendance.view`   | `AttendanceCheckInPayload`      | `EmployeeShift` (+ audit) |
| `checkOutFn`          | POST   | `attendance.view`   | `AttendanceCheckOutPayload`     | `EmployeeShift` (+ audit) |
| `getMyAttendanceFn`   | GET    | `attendance.view`   | `dateParamSchema`               | `AttendanceResponse` |
| `getAttendanceHistoryFn` | GET | `attendance.view`   | `AttendanceFilters`           | `AttendanceHistoryResponse` |
| `getAttendanceSummaryFn` | GET | `attendance.view`   | —                               | `AttendanceSummaryResponse` |
| `getMyLeavesFn`       | GET    | `leave.view`        | `LeaveFilters`                  | `LeaveListResponse`  |
| `createLeaveRequestFn`| POST   | `leave.view`        | `LeaveRequestPayload`           | `Leave`              |
| `getPerformanceStatsFn` | GET  | `attendance.view`   | —                               | `PerformanceStatsResponse` |
| `getLocationsFn`      | GET    | `attendance.view`   | —                               | `Location[]`         |
| `getShiftsFn`         | GET    | `attendance.view`   | —                               | `Shift[]`            |
| `requestAttendanceCorrectionFn` | POST | `attendance.view` | `AttendanceCorrectionRequestPayload` | `AttendanceCorrection` (+ audit) |

### Attendance — admin management

Admin endpoints require `attendance.edit` (or `attendance.delete` where noted);
route guards use the `attendance_admin` module for nav visibility. The `attendance.view`
permission grants employees their self-service card but never admin pages.

> HR retains `attendance.edit` by intentional product decision (attendance expansion, 2026-08-04).

| Function              | Method | Required permission | Payload                         | Returns              |
| --------------------- | ------ | ------------------- | ------------------------------- | -------------------- |
| `createLocationFn`    | POST   | `attendance.edit`   | `LocationMutationPayload`       | `Location` (+ audit) |
| `updateLocationFn`    | POST   | `attendance.edit`   | `{ id, values }`                | `Location` (+ audit) |
| `deleteLocationFn`    | POST   | `attendance.delete` | `{ id }`                        | `{ success }` (+ audit) |
| `getSchedulesFn`      | GET    | `attendance.view`   | —                               | `Shift[]`            |
| `createScheduleFn`    | POST   | `attendance.edit`   | `ScheduleMutationPayload`       | `Shift` (+ audit)    |
| `updateScheduleFn`    | POST   | `attendance.edit`   | `{ id, values }`                | `Shift` (+ audit)    |
| `getScheduleAssignmentsFn` | GET | `attendance.edit`   | `{ date? }`                     | `ScheduleAssignmentsResponse` |
| `assignScheduleFn`    | POST   | `attendance.edit`   | `AssignSchedulePayload`         | `{ success }` (+ audit) |
| `bulkAssignScheduleFn`| POST   | `attendance.edit`   | `BulkAssignSchedulePayload`     | `{ assigned }` (+ audit) |
| `createScheduleOverrideFn` | POST | `attendance.edit` | `ScheduleOverridePayload`      | `{ success }` (+ audit) |
| `createDayOffFn`      | POST   | `attendance.edit`   | `DayOffPayload`                 | `{ success }` (+ audit) |
| `deleteDayOffFn`      | POST   | `attendance.delete` | `{ id }`                        | `{ success }` (+ audit) |
| `reviewAttendanceCorrectionFn` | POST | `attendance.edit` | `ReviewCorrectionPayload`      | `AttendanceCorrection` (+ audit) |
| `getAdminAttendanceReportFn` | GET | `attendance.edit`   | `AttendanceReportFilters`       | `AttendanceReportResponse` |
| `exportAttendanceReportFn` | POST | `attendance.edit`   | `AttendanceReportExportPayload` | `{ fileName, data }` |

### Tasks

| Function          | Method | Required permission | Payload             | Returns        |
| ----------------- | ------ | ------------------- | ------------------- | -------------- |
| `getMyTasksFn`    | GET    | `my_work.view`      | —                   | `MyTasksResponse` |
| `getAvailableTasksFn` | GET | `jobs.view`        | `AvailableTaskFilters` | `AvailableTasksResponse` |
| `getTaskDetailFn` | GET    | `my_work.view`      | `{ taskId }`        | `TaskDetailResponse` |
| `takeTaskFn`      | POST   | `jobs.view`         | `{ taskId }`        | `TaskActionResponse` (+ audit) |
| `completeTaskFn`  | POST   | `my_work.view`      | `{ taskId }`        | `TaskActionResponse` (+ audit) |

### Masterdata

| Function                  | Method | Required permission | Payload                         | Returns              |
| ------------------------- | ------ | ------------------- | ------------------------------- | -------------------- |
| `getDepartmentsFn`        | GET    | `departments.view`  | —                               | `Department[]`       |
| `createDepartmentFn`      | POST   | `departments.add`   | `DepartmentMutationPayload`     | `Department` (+ audit) |
| `updateDepartmentFn`      | POST   | `departments.edit`  | `{ id, values }`                | `Department` (+ audit) |
| `deleteDepartmentFn`      | POST   | `departments.delete`| `{ id }`                        | `{ success }` (+ audit) |
| `getDesignationsFn`       | GET    | `designations.view` | `{ department_id? }`            | `Designation[]`      |
| `createDesignationFn`     | POST   | `designations.add`  | `DesignationMutationPayload`    | `Designation` (+ audit) |
| `updateDesignationFn`     | POST   | `designations.edit` | `{ id, values }`                | `Designation` (+ audit) |
| `deleteDesignationFn`     | POST   | `designations.delete` | `{ id }`                      | `{ success }` (+ audit) |
| `getDesignationOptionsFn` | GET    | `designations.view` | —                               | `DesignationOption[]`|

### Audit log

| Function           | Method | Required permission | Payload                  | Returns         |
| ------------------ | ------ | ------------------- | ------------------------ | --------------- |
| `getAuditLogFn`    | GET    | `audit_log.view`    | `{ page?, perPage?, action? }` | `{ total, rows }` |

### Role groups

| Function              | Method | Required permission | Payload                 | Returns           |
| --------------------- | ------ | ------------------- | ----------------------- | ----------------- |
| `listRoleGroupsFn`    | GET    | `role_groups.view`  | —                       | `RoleGroup[]`     |
| `getRoleGroupFn`      | GET    | `role_groups.view`  | `roleGroupIdSchema`     | `RoleGroupDetail` |
| `createRoleGroupFn`   | POST   | `role_groups.add`   | `RoleGroupMutationPayload` | `RoleGroup` (+ audit) |
| `updateRoleGroupFn`   | POST   | `role_groups.edit`  | `{ id, values }`        | `RoleGroup` (+ audit) |
| `deleteRoleGroupFn`   | POST   | `role_groups.delete`| `roleGroupIdSchema`     | `{ success }` (+ audit) |

Self-service (sidebar visibility — requires any session, no permission):

| Function                    | Method | Guard          | Payload | Returns          |
| --------------------------- | ------ | -------------- | ------- | ---------------- |
| `getCurrentUserRoleGroupFn` | GET    | `requireSession` | —     | `CurrentUserRoleGroup` |

### RBAC guard semantics

- `requirePermission(module, action)` — resolves the caller's role group
  (`user_role_groups` → `role_groups`) and allows when: the legacy role is
  `admin`, the group has `is_admin = true`, or
  `permissions[module][action] === true`. Users with no role group are denied
  (`Forbidden: <module>.<action> required`).
- `hasModulePermission(permissions, isAdmin, module, action)` — pure, exported
  version of the same check (unit-tested, used by the client sidebar).
- Legacy guards (no longer used by feature services, kept for compatibility):
  - `requireRole(role)` — exact-set membership (`employee` and `technician`
    are distinct; neither implies the other).
  - `requireMinRole('employee' | 'hr' | 'admin')` — hierarchical
    (employee ≡ technician < hr < admin).
- The `createAccessControl` matrix in `src/lib/auth/permissions.ts` is
  retained but not consulted by server functions.

## Authentication

Uses **Better Auth** v1, a DB-session-based auth system integrated directly with Drizzle ORM and TanStack Start.

Better Auth's built-in rate limiter is enabled on auth endpoints: sign-in (`/api/v1/auth/sign-in/email`) allows 5 attempts per 60 s, all other auth endpoints 100 per 60 s. Tunable via `AUTH_RATE_LIMIT_WINDOW`, `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX_SIGNIN` (see `.env.example`).

### Key Files

| File                          | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `src/lib/auth/auth.server.ts` | Auth server config (plugins, callbacks)        |
| `src/lib/auth/auth-client.ts` | Client-side auth helpers                       |
| `src/lib/auth/session.ts`     | `requireSession()` / `requirePermission()` / `hasModulePermission()` |
| `src/lib/auth/permissions.ts` | Legacy `createAccessControl` matrix (retained, not consulted) |
| `src/lib/db/role-groups.ts`   | Role group CRUD + `getUserRoleGroup`/`setUserRoleGroup` + `mapRoleGroupToLegacyRole` |
| `src/lib/db/auth-schema.ts`   | Drizzle schema for Better Auth tables          |
| `src/routes/api/v1/auth/$.ts` | Catch-all API route for Better Auth            |

### Endpoints

| Endpoint      | Methods  | Purpose                         |
| ------------- | -------- | ------------------------------- |
| `/api/v1/auth/$` | GET/POST | Better Auth handler (catch-all) |

Client-side helpers: `authClient.signIn.email`, `authClient.signUp.email`, `authClient.signOut`, `authClient.useSession`.

Server-side helpers: `auth.api.getSession`, `auth.api.listUsers` (admin), `auth.api.createUser` (admin).

### Auth Tables (Better Auth)

Better Auth owns four tables in the database:

- `user` — email, hashed password, name, role, banned status
- `session` — session tokens tied to users (server-managed)
- `account` — OAuth / email account links (supports future social auth)
- `verification` — email verification codes

These replace the old single `users` table and custom JWT. Role and ban status
are stored on the `user` table directly, managed through the Better Auth `admin` plugin.

### Flow

#### Sign In

1. User submits email + password in `user-auth-form.tsx`
2. Form calls `authClient.signIn.email({ email, password })`
3. Better Auth validates credentials, creates a session, sets cookies via `tanstackStartCookies` plugin
4. On success, the client navigates to `/dashboard`

#### Sign Up

1. User submits name + email + password in `register-form.tsx`
2. Form calls `authClient.signUp.email({ name, email, password })`
3. Better Auth creates the user record + initial session
4. On success, the client navigates to `/dashboard`

#### Session Check (Route Guard)

Dashboard routes use a `beforeLoad` handler:

```ts
beforeLoad: async ({ location }) => {
  if (location.pathname.startsWith('/dashboard')) {
    await ensureSession();
  }
};
```

`ensureSession()` calls `auth.api.getSession({ headers })` and redirects to
`/auth/sign-in` if the session is missing or expired.

#### Sign Out

The sidebar "Sign out" button calls `authClient.signOut()`, then navigates
to `/auth/sign-in`.

### RBAC (Role-Based Access Control)

Authorization is **DB-backed role groups**: each user is assigned one role
group (`user_role_groups` → `role_groups`), and the group's JSONB permission
map drives both the server guards and the client sidebar.

**Tables:**

| Table | Purpose |
| ----- | ------- |
| `role_groups` | id, name (unique), description, `permissions` JSONB (`{ <module>: { view/add/edit/delete: bool } }`), `is_admin` bool, timestamps |
| `user_role_groups` | `user_id` (PK) → `role_group_id` (FK) |

**Server guard:**

```ts
// src/lib/auth/session.ts
export async function requirePermission(
  module: string,
  action: PermissionAction // 'view' | 'add' | 'edit' | 'delete'
): Promise<Session> {
  const session = await requireSession();
  const { permissions, isAdmin } = await getCurrentUserRoleGroup(session.user.id);
  if (
    session.user.role === 'admin' || // legacy admin bypass
    isAdmin ||
    hasModulePermission(permissions, isAdmin, module, action)
  ) {
    return session;
  }
  throw new Error(`Forbidden: ${module}.${action} required`);
}
```

**Pure check** (unit-tested, reused by the sidebar via `useRoleGroupPermissions`):

```ts
export function hasModulePermission(
  permissions: Record<string, Record<string, boolean>>,
  isAdmin: boolean,
  module: string,
  action: string
): boolean {
  return isAdmin || permissions[module]?.[action] === true;
}
```

**Role-group semantics:**
- Legacy role `admin` always bypasses the matrix.
- A group with `is_admin = true` bypasses the matrix for all its members.
- Otherwise the member must have the exact `permissions[module][action] === true`.
- A user with **no** role group is denied (`Forbidden: <module>.<action> required`).
- `user.role` stays in sync via `mapRoleGroupToLegacyRole`
  (Administrator→admin, HR→hr, Employee→employee, Technician→technician,
  custom→employee, empty→user) so legacy role checks keep working.

**Seeded role groups** (via `scripts/seed.ts`):

| Role group | is_admin | Grants |
| ---------- | -------- | ------ |
| Administrator | ✅ | Full system access (bypasses matrix) |
| HR | — | employees add/edit/delete, departments add/edit, designations add/edit, users view, audit_log view, attendance edit (+ admin nav via `attendance_admin.view`), core modules (overview/my_work/attendance/leave/profile) view |
| Employee | — | core modules (overview/my_work/attendance/leave/profile view) + jobs view + notifications view |
| Technician | — | core modules (overview/my_work/attendance/leave/profile view) + jobs view + notifications view |

Legacy guards `requireRole(role)` (exact set) and `requireMinRole(...)`
(hierarchical) remain exported for compatibility but are no longer used by
feature services.

### Configuration

Auth config lives in `src/lib/auth/auth.server.ts`:

```ts
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : {
        allowedHosts: ['localhost:*', '127.0.0.1:*', '172.17.16.3:*'],
        protocol: 'auto',
        fallback: 'http://localhost:3000'
      },
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  plugins: [admin(), tanstackStartCookies()]
});
```

- **Email + password** authentication is enabled
- **Admin plugin** adds RBAC + user management endpoints
- **tanstackStartCookies** adapts cookie handling to TanStack Start's `request`/`response` objects
- **fallback** resolves the base URL when running outside an HTTP request context (e.g., seed scripts)

### Demo Credentials

`scripts/seed.ts` seeds demo accounts (idempotent):

| Email               | Password       | Role group |
| ------------------- | -------------- | ---------- |
| `admin@example.com` | `Password123!` | Administrator |
| `hr@example.com`    | `Password123!` | HR |
| `employee@example.com` | `Password123!` | Employee |
| `technician@example.com` | `Password123!` | Technician |

All demo accounts have linked employee records with seed masterdata.

### TanStack Start Splat Handler

Better Auth's endpoints are multi-segment (`/sign-in/email`, `/admin/create-user`, …),
so they live under a catch-all route `src/routes/api/v1/auth/$.ts` (`$` is TanStack
Start's splat). TanStack Start only invokes a route's `server.handlers` on exact
matches by default, so `node_modules/@tanstack/start-server-core` is patched to
also fire on splat routes. `scripts/postinstall.js` re-applies this patch after
`bun install`.

### Form Components

#### `user-auth-form.tsx`

- Renders email + password fields with show/hide eye toggle
- On submit: `authClient.signIn.email(...)`
- On success: navigates to `/dashboard`

#### `register-form.tsx`

- Renders name + email + password + confirm-password fields with independent eye toggles
- On submit: `authClient.signUp.email(...)` with combined `name`
- On success: navigates to `/dashboard`

### Migration from Custom JWT

The old `bcryptjs` and `jose` packages have been removed. All user management
(create, update, delete, list) now goes through the Better Auth admin API via
`src/lib/db/users.ts`.

## Development Tools

### Drizzle Studio

A web-based GUI for database inspection and management.

**Start:**
```bash
bun run db:studio
```

**Access:** `https://local.drizzle.studio` (UI is Cloudflare-hosted, connects to local server)

**Remote access:** Use SSH tunnel:
```bash
ssh -L 4983:localhost:4983 user@172.17.16.3
# Then open: https://local.drizzle.studio?host=127.0.0.1&port=4983
```

**Note:** Drizzle Studio is for local development only. For VPS deployment, use
Drizzle Studio Gateway (alpha) or alternative database GUIs (pgAdmin, DBeaver).

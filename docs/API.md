# API Documentation

## Server Functions

All server functions are defined in `src/features/<feature>/api/service.ts`
and expose database operations via `createServerFn()`. Handlers use dynamic
imports to prevent the `postgres` driver from leaking into the client bundle.

### RPC boundary guarantees

- **Authentication**: every endpoint calls `requireSession()`, `requireRole(...)`
  or `requireMinRole(...)` at the top of its handler (`src/lib/auth/session.ts`),
  so endpoints cannot be called unauthenticated — independent of route guards.
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

Role legend: **user** = any authenticated session; **staff** = employee or
technician (via `requireMinRole('employee')`); **hr** = admin or hr;
**admin** = admin only.

### Products

| Function           | Method | Required role | Payload                  | Returns                |
| ------------------ | ------ | ------------- | ------------------------ | ---------------------- |
| `getProductsFn`    | GET    | user          | `ProductFilters`         | `ProductsResponse`     |
| `getProductByIdFn` | GET    | user          | `number` (id)            | `ProductByIdResponse`  |
| `createProductFn`  | POST   | admin         | `ProductMutationPayload` | `Product`              |
| `updateProductFn`  | POST   | admin         | `{ id, values }`         | `Product`              |
| `deleteProductFn`  | POST   | admin         | `number` (id)            | `{ success, message }` |

### Users

| Function       | Method | Required role | Payload               | Returns                |
| -------------- | ------ | ------------- | --------------------- | ---------------------- |
| `getUsersFn`   | GET    | admin         | `UserFilters`         | `UsersResponse`        |
| `createUserFn` | POST   | admin         | `UserMutationPayload` | `User` (+ audit)       |
| `updateUserFn` | POST   | admin         | `{ id, values }`      | `User` (+ audit)       |
| `deleteUserFn` | POST   | admin         | `number` (id)         | `{ success, message }` (+ audit) |

### Employees

| Function            | Method | Required role | Payload                     | Returns                |
| ------------------- | ------ | ------------- | --------------------------- | ---------------------- |
| `listEmployeesFn`   | GET    | user          | `EmployeeFilters`           | `EmployeesResponse`    |
| `getEmployeeByIdFn` | GET    | user          | `employeeIdSchema` (id)     | `EmployeeByIdResponse` |
| `createEmployeeFn`  | POST   | hr            | `EmployeeMutationPayload`   | `Employee` (+ audit)   |
| `updateEmployeeFn`  | POST   | hr            | `{ id, values }`            | `Employee` (+ audit)   |
| `deleteEmployeeFn`  | POST   | hr            | `employeeIdSchema` (id)     | `{ success, message }` (+ audit) |

### Customers

| Function            | Method | Required role | Payload                     | Returns                |
| ------------------- | ------ | ------------- | --------------------------- | ---------------------- |
| `listCustomersFn`   | GET    | user          | `CustomerFilters`           | `CustomersResponse`    |
| `getCustomerByIdFn` | GET    | user          | `customerIdSchema` (id)     | `CustomerByIdResponse` |
| `createCustomerFn`  | POST   | admin         | `CustomerMutationPayload`   | `Customer` (+ audit)   |
| `updateCustomerFn`  | POST   | admin         | `{ id, values }`            | `Customer` (+ audit)   |
| `deleteCustomerFn`  | POST   | admin         | `customerIdSchema` (id)     | `{ success, message }` (+ audit) |

### Notifications

| Function               | Method | Required role | Payload                  | Returns                |
| ---------------------- | ------ | ------------- | ------------------------ | ---------------------- |
| `getNotificationsFn`   | GET    | user          | —                        | `NotificationsResponse`|
| `markAsReadFn`         | POST   | user          | `{ id: string }`         | `{ success: boolean }` |
| `markAllAsReadFn`      | POST   | user          | —                        | `{ success: boolean }` |
| `addNotificationFn`    | POST   | user          | `AddNotificationPayload` | `NotificationItem` (+ audit) |
| `removeNotificationFn` | POST   | user          | `{ id: string }`         | `{ success: boolean }` (+ audit) |

Polling: the query refetches every 30 s (see `docs/NOTIFICATIONS.md`).

### Attendance

| Function              | Method | Required role | Payload                         | Returns              |
| --------------------- | ------ | ------------- | ------------------------------- | -------------------- |
| `checkInFn`           | POST   | staff         | `AttendanceCheckInPayload`      | `EmployeeShift` (+ audit) |
| `checkOutFn`          | POST   | staff         | `AttendanceCheckOutPayload`     | `EmployeeShift` (+ audit) |
| `getMyAttendanceFn`   | GET    | staff         | `dateParamSchema`               | `AttendanceResponse` |
| `getAttendanceHistoryFn` | GET | staff         | `AttendanceFilters`           | `AttendanceHistoryResponse` |
| `getMyLeavesFn`       | GET    | staff         | `LeaveFilters`                  | `LeaveListResponse`  |
| `createLeaveRequestFn`| POST   | staff         | `LeaveRequestPayload`           | `Leave`              |
| `getPerformanceStatsFn` | GET  | staff         | —                               | `PerformanceStatsResponse` |
| `getLocationsFn`      | GET    | staff         | —                               | `Location[]`         |
| `getShiftsFn`         | GET    | staff         | —                               | `Shift[]`            |

### Masterdata

| Function                  | Method | Required role | Payload                         | Returns              |
| ------------------------- | ------ | ------------- | ------------------------------- | -------------------- |
| `getDepartmentsFn`        | GET    | admin         | —                               | `Department[]`       |
| `createDepartmentFn`      | POST   | admin         | `DepartmentMutationPayload`     | `Department` (+ audit) |
| `updateDepartmentFn`      | POST   | admin         | `{ id, values }`                | `Department` (+ audit) |
| `deleteDepartmentFn`      | POST   | admin         | `{ id }`                        | `{ success }` (+ audit) |
| `getDesignationsFn`       | GET    | admin         | `{ department_id? }`            | `Designation[]`      |
| `createDesignationFn`     | POST   | admin         | `DesignationMutationPayload`    | `Designation` (+ audit) |
| `updateDesignationFn`     | POST   | admin         | `{ id, values }`                | `Designation` (+ audit) |
| `deleteDesignationFn`     | POST   | admin         | `{ id }`                        | `{ success }` (+ audit) |
| `getDesignationOptionsFn` | GET    | staff         | —                               | `DesignationOption[]`|
| `getAuditLogFn`           | GET    | admin         | `{ page?, perPage?, action? }`  | `{ total, rows }`    |

### RBAC guard semantics

- `requireRole(role)` — exact-set membership (see `src/lib/auth/session.ts`).
  `employee` and `technician` are distinct; neither implies the other.
- `requireMinRole('employee' | 'hr' | 'admin')` — hierarchical
  (employee ≡ technician < hr < admin).
- `requireRole('user')` / `requireRole('customer')` — any authenticated session.
- The fine-grained `createAccessControl` matrix in `src/lib/auth/permissions.ts`
  is reserved for future per-entity checks and is not yet consulted.

## Authentication

Uses **Better Auth** v1, a DB-session-based auth system integrated directly with Drizzle ORM and TanStack Start.

Better Auth's built-in rate limiter is enabled on auth endpoints: sign-in (`/api/v1/auth/sign-in/email`) allows 5 attempts per 60 s, all other auth endpoints 100 per 60 s. Tunable via `AUTH_RATE_LIMIT_WINDOW`, `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX_SIGNIN` (see `.env.example`).

### Key Files

| File                          | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `src/lib/auth/auth.server.ts` | Auth server config (plugins, callbacks)        |
| `src/lib/auth/auth-client.ts` | Client-side auth helpers                       |
| `src/lib/auth/session.ts`     | `getSession()` / `ensureSession()`             |
| `src/lib/auth/permissions.ts` | RBAC access control with `createAccessControl` |
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

Better Auth's `admin` plugin powers all role/permission checks:

```ts
// src/lib/auth/permissions.ts
const statements = {
  user: ['create', 'read', 'update', 'delete'],
  attendance: ['create', 'read', 'update', 'delete'],
  leave: ['create', 'read', 'update', 'delete'],
  employee: ['read'],
  department: ['read'],
  designation: ['read'],
  shift: ['read'],
  location: ['read']
};

export const admin = ac.newRole({
  user: ['create', 'read', 'update', 'delete'],
  attendance: ['create', 'read', 'update', 'delete'],
  leave: ['create', 'read', 'update', 'delete'],
  employee: ['create', 'read', 'update', 'delete'],
  department: ['create', 'read', 'update', 'delete'],
  designation: ['create', 'read', 'update', 'delete'],
  shift: ['create', 'read', 'update', 'delete'],
  location: ['create', 'read', 'update', 'delete']
});

export const hr = ac.newRole({
  user: ['read'],
  attendance: ['read', 'update'],
  leave: ['create', 'read', 'update', 'delete'],
  employee: ['read'],
  department: ['read'],
  designation: ['read'],
  shift: ['read'],
  location: ['read']
});

export const employee = ac.newRole({
  user: ['read'],
  attendance: ['create', 'read'],
  leave: ['create', 'read'],
  employee: ['read'],
  department: ['read'],
  designation: ['read'],
  shift: ['read'],
  location: ['read']
});
```

**Role Requirements:**
- `admin` — Full access to all modules
- `hr` — Attendance corrections, leave management, employee read-only
- `employee` / `technician` — Self-service attendance, leave requests, own data

**Update to `requireRole()` function:**

```ts
// src/lib/auth/session.ts
const allowedRoles = ['admin', 'hr', 'employee', 'technician', 'user'] as const;

export async function requireRole(role: AllowedRole) {
  const session = await requireSession();
  if (role === 'admin' && session.user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  if (role === 'hr' && !['admin', 'hr'].includes(session.user.role)) {
    throw new Error('Forbidden: HR access required');
  }
  return session;
}
```

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

| Email               | Password       | Role      |
| ------------------- | -------------- | --------- |
| `admin@example.com` | `Password123!` | admin     |
| `hr@example.com`    | `Password123!` | hr        |
| `employee@example.com` | `Password123!` | employee |
| `technician@example.com` | `Password123!` | technician |

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

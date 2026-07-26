# API Documentation

## Server Functions

All server functions are defined in `src/features/<feature>/api/service.ts`
and expose database operations via `createServerFn()`. Handlers use dynamic
imports to prevent the `postgres` driver from leaking into the client bundle.

### RPC boundary guarantees

- **Authentication**: every endpoint calls `requireSession()` (or
  `requireRole('admin')` for product/user writes) at the top of its handler,
  so endpoints cannot be called unauthenticated — independent of route guards.
- **Input validation**: every endpoint uses a Zod schema from
  `src/features/<feature>/api/validation.ts` via `@tanstack/zod-adapter`'s
  `zodValidator`. Schemas are typed `z.ZodType<ExistingType>` so they cannot
  drift from the request types.
- **Error mapping**: `lib/db/*.ts` wraps DB calls in `mapDbError`
  (`src/lib/errors.ts`); intentional errors throw `DomainError` and pass
  through, unexpected errors become a generic message.

### Products

| Function           | Method | Payload                  | Returns                |
| ------------------ | ------ | ------------------------ | ---------------------- |
| `getProductsFn`    | GET    | `ProductFilters`         | `ProductsResponse`     |
| `getProductByIdFn` | GET    | `number` (id)            | `ProductByIdResponse`  |
| `createProductFn`  | POST   | `ProductMutationPayload` | `Product`              |
| `updateProductFn`  | POST   | `{ id, values }`         | `Product`              |
| `deleteProductFn`  | POST   | `number` (id)            | `{ success, message }` |

### Users

| Function       | Method | Payload               | Returns                |
| -------------- | ------ | --------------------- | ---------------------- |
| `getUsersFn`   | GET    | `UserFilters`         | `UsersResponse`        |
| `createUserFn` | POST   | `UserMutationPayload` | `User`                 |
| `updateUserFn` | POST   | `{ id, values }`      | `User`                 |
| `deleteUserFn` | POST   | `number` (id)         | `{ success, message }` |

### Kanban

| Function     | Method | Payload           | Returns                  |
| ------------ | ------ | ----------------- | ------------------------ |
| `getBoardFn` | GET    | —                 | `Record<string, Task[]>` |
| `addTaskFn`  | POST   | `AddTaskPayload`  | `Task`                   |
| `moveTaskFn` | POST   | `MoveTaskPayload` | `{ success }`            |

### Notifications

| Function               | Method | Payload                  | Returns                |
| ---------------------- | ------ | ------------------------ | ---------------------- |
| `getNotificationsFn`   | GET    | —                        | `NotificationItem[]`   |
| `markAsReadFn`         | POST   | `{ id: number }`         | `{ success: boolean }` |
| `markAllAsReadFn`      | POST   | —                        | `{ success: boolean }` |
| `addNotificationFn`    | POST   | `AddNotificationPayload` | `NotificationItem`     |
| `removeNotificationFn` | POST   | `{ id: number }`         | `{ success: boolean }` |

### Attendance

| Function              | Method | Payload                         | Returns              |
| --------------------- | ------ | ------------------------------- | -------------------- |
| `checkInFn`           | POST   | `AttendanceCheckInPayload`      | `EmployeeShift`      |
| `checkOutFn`          | POST   | `AttendanceCheckOutPayload`     | `EmployeeShift`      |
| `getMyAttendanceFn`   | GET    | —                               | `AttendanceResponse` |
| `getAttendanceHistoryFn` | GET | `AttendanceFilters`           | `AttendanceHistoryResponse` |
| `getMyLeavesFn`       | GET    | `LeaveFilters`                  | `LeaveListResponse`  |
| `createLeaveRequestFn`| POST   | `LeaveRequestPayload`           | `Leave`              |
| `getPerformanceStatsFn` | GET  | —                               | `PerformanceStatsResponse` |
| `getLocationsFn`      | GET    | —                               | `Location[]`         |
| `getShiftsFn`         | GET    | —                               | `Shift[]`            |

### Masterdata

| Function                  | Method | Payload                         | Returns              |
| ------------------------- | ------ | ------------------------------- | -------------------- |
| `getDepartmentsFn`        | GET    | —                               | `Department[]`       |
| `createDepartmentFn`      | POST   | `DepartmentMutationPayload`     | `Department`         |
| `updateDepartmentFn`      | POST   | `{ id, values }`                | `Department`         |
| `deleteDepartmentFn`      | POST   | `{ id }`                        | `{ success }`        |
| `getDesignationsFn`       | GET    | `{ department_id? }`            | `Designation[]`      |
| `createDesignationFn`     | POST   | `DesignationMutationPayload`    | `Designation`        |
| `updateDesignationFn`     | POST   | `{ id, values }`                | `Designation`        |
| `deleteDesignationFn`     | POST   | `{ id }`                        | `{ success }`        |
| `getDesignationOptionsFn` | GET    | —                               | `DesignationOption[]`|

## Authentication

Uses **Better Auth** v1, a DB-session-based auth system integrated directly with Drizzle ORM and TanStack Start.

### Key Files

| File                          | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `src/lib/auth/auth.ts`        | Auth server config (plugins, callbacks)        |
| `src/lib/auth/auth-client.ts` | Client-side auth helpers                       |
| `src/lib/auth/session.ts`     | `getSession()` / `ensureSession()`             |
| `src/lib/auth/permissions.ts` | RBAC access control with `createAccessControl` |
| `src/lib/db/auth-schema.ts`   | Drizzle schema for Better Auth tables          |
| `src/routes/api/auth/$.ts`    | Catch-all API route for Better Auth            |

### Endpoints

| Endpoint      | Methods  | Purpose                         |
| ------------- | -------- | ------------------------------- |
| `/api/auth/$` | GET/POST | Better Auth handler (catch-all) |

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

Auth config lives in `src/lib/auth/auth.ts`:

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
so they live under a catch-all route `src/routes/api/auth/$.ts` (`$` is TanStack
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

# User & Database Redesign

## Problem

Current `employees` table has structural issues:
- `employees.id` uses `serial` while `user.id` is `text` (Better Auth string ID) — inconsistency
- No foreign key constraint on `employees.user_id` → `user.id`
- No Drizzle `relations` defined for `employees` → `user`
- No `customers` table exists despite ~1000 customer requirement
- No `user_type` / role constraint to enforce 1 user = 1 profile

## Design

### Principles

- **1 user = 1 role** — enforced at DB and auth boundary. A user with `role = 'customer'` must have exactly one `customers` row. A user with `role = 'employee'` or `'technician'` must have exactly one `employees` row. Admin/HR have no profile row (they manage the system).
- **No NULL values** — all profile fields are `NOT NULL`. If a field is truly optional, provide a sensible default or empty string.
- **English-only in code** — all user-facing text uses i18next keys; no hardcoded English or Indonesian strings in source.
- **TanStack ecosystem** — keep Better Auth for auth, Drizzle for schema, PostgreSQL 17.

### Auth Table (Better Auth, unchanged)

```sql
user (id: text PK, name: text, email: text unique, role: text,
      email_verified: boolean, image: text?, created_at, updated_at,
      banned: boolean?, ban_reason: text?, ban_expires: timestamp?)
```

Current roles: `admin`, `hr`, `employee`, `technician`
New role: `customer`

### Employee Profile (fix existing)

```sql
employees (
  id: text PK,                   -- ✅ same as user.id
  employee_code: text unique,    -- e.g. "EMP-001"
  full_name: text NOT NULL,
  nickname: text NOT NULL DEFAULT '',
  email: text NOT NULL,
  phone: text NOT NULL DEFAULT '',
  birth_place: text NOT NULL DEFAULT '',
  birth_date: date NOT NULL,
  address: text NOT NULL DEFAULT '',
  id_number: text unique NOT NULL DEFAULT '',
  department_id: integer NOT NULL,
  designation_id: integer NOT NULL,
  is_internship: boolean NOT NULL DEFAULT false,
  employment_status: text NOT NULL DEFAULT 'active',
  join_date: date NOT NULL,
  leave_date: date?,             -- nullable by exception: NULL until employee leaves
  base_salary: real NOT NULL DEFAULT 0,
  status: text NOT NULL DEFAULT 'active',
  created_at, updated_at
)
```

Key changes from current:
- `id` changed from `serial` to `text` — use same value as `user.id`
- Foreign key: `id` → `user.id` ON DELETE CASCADE
- Removed `user_id` column (redundant — `id` IS the user ID)
- Added `NOT NULL` constraints and defaults
- Added Drizzle `relations` linking to `user`

### Customer Profile (new)

```sql
customers (
  id: text PK,                   -- same as user.id
  customer_code: text unique,    -- e.g. "CUST-001"
  full_name: text NOT NULL,
  email: text NOT NULL,
  phone: text NOT NULL,
  address: text NOT NULL DEFAULT '',
  latitude: real NOT NULL DEFAULT 0,
  longitude: real NOT NULL DEFAULT 0,
  id_card_number: text unique NOT NULL DEFAULT '',
  id_card_photo: text NOT NULL DEFAULT '',
  service_data: text NOT NULL DEFAULT '{}',  -- JSON: ONT config, WiFi credentials, etc.
  billing_address: text NOT NULL DEFAULT '',
  notes: text NOT NULL DEFAULT '',
  status: text NOT NULL DEFAULT 'active',
  created_by: text NOT NULL,      -- admin/employee who created this customer
  created_at, updated_at
)
```

Foreign keys:
- `id` → `user.id` ON DELETE CASCADE
- `created_by` → `user.id` (admin/hr/employee who registered the customer)

External services integration fields (payment gateway, ONT provisioning, etc.) deferred — add as JSON columns or separate tables when needed.

### Attendance Tables (unchanged)

Attendance tables (`employee_shifts`, `leaves`, etc.) already use `user_id: text` — no change needed. They reference `user.id` via application logic; add FK constraints as a follow-up.

### Relations

```typescript
// auth-schema.ts — add:
userRelations: user → one(employee), one(customer)

// masterdata.ts — add:
employeeRelations: employee → one(user), one(department), one(designation)
customerRelations: customer → one(user), one(created_by)

// attendance.ts — add FK + relations:
employeeShiftRelations: employeeShift → one(user), one(shift)
leaveRelations: leave → one(user), one(shift)
performanceReportRelations: performanceReport → one(user)
```

### Role Enforcement

1. **DB level** — trigger or application-level check: when `user.role` is set, validate that the corresponding profile exists and no conflicting profile exists
2. **Auth boundary** — `requireRole()` in server functions
3. **Route level** — `beforeLoad` guards in TanStack Router

### Migration

1. Create `customers` table
2. Alter `employees` table:
   - Drop `user_id` column
   - Change `id` type from `serial` to `text`, populate with `user.id` values
   - Add FK: `id` → `user.id`
   - Add `NOT NULL` constraints
3. Add Drizzle `relations` for all new links
4. Add `customer` role to RBAC permission set
5. Add `customer` dashboard route (conditional layout similar to MobileShell for employee/technician)
6. Update seed script to create demo customer records

### Customer Dashboard Access

Customers get their own dashboard via the existing conditional layout pattern in `dashboard.tsx`:
- `admin`/`hr` → sidebar layout
- `employee`/`technician` → MobileShell
- `customer` → CustomerShell (new mobile-first layout: billing, service info, ticket creation, ONT config)

### Customer Self-Service Routes (future)

```
/dashboard/customer/billing      — invoice list, payment
/dashboard/customer/service      — ONT config, WiFi password change
/dashboard/customer/tickets      — create/view support tickets
/dashboard/customer/records      — usage history, payment history
```

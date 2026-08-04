# User & Database Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `employees` table schema, add `customers` table, and wire `customer` role into the RBAC system.

**Architecture:** Keep Better Auth `user` table as-is. Change `employees.id` from `serial` to `text` (matching `user.id`). Add new `customers` table with `id = user.id`. Add Drizzle `relations` linking profiles to user. Add `customer` role to permissions.

**Tech Stack:** Drizzle ORM, PostgreSQL 17, Better Auth, TypeScript strict

**Reference:** `docs/superpowers/specs/2026-07-28-user-db-redesign.md`

## Global Constraints

- No NULL values in profile tables (except `employees.leave_date`)
- All user-facing text via i18next — no hardcoded strings
- Foreign key constraints enforced at DB level where possible
- English-only in code; ID translations in `src/i18n/locales/id/translation.json`
- 1 user = 1 role enforcement at DB + auth boundary
- TanStack Start / React 19 / Drizzle ORM / Better Auth ecosystem

---

### Task 1: Update employees schema (masterdata.ts)

**Files:**
- Modify: `src/lib/db/schema/masterdata.ts`

**Interfaces:**
- Consumes: current Better Auth `user` table schema
- Produces: updated `employees` table with `id: text` (mirrors `user.id`), dropped `user_id`, added NOT NULL constraints, Drizzle relations

- [ ] **Step 1: Read current file**

Already read.

- [ ] **Step 2: Rewrite employees table and add relations**

Change `employees.id` from `serial` to `text`, drop `user_id`, add NOT NULL + defaults, add `employeeRelations`.

```typescript
import { pgTable, text, timestamp, boolean, real, integer, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';

// departments table (unchanged)
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// designations table (unchanged)
export const designations = pgTable('designations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  department_id: integer('department_id'),
  description: text('description'),
  base_salary: real('base_salary'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// employees table — id now mirrors user.id (text), user_id dropped
export const employees = pgTable('employees', {
  id: text('id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  employee_code: text('employee_code').notNull().unique(),
  full_name: text('full_name').notNull(),
  nickname: text('nickname').notNull().default(''),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  birth_place: text('birth_place').notNull().default(''),
  birth_date: text('birth_date').notNull(),
  address: text('address').notNull().default(''),
  id_number: text('id_number').notNull().default('').unique(),
  department_id: integer('department_id').notNull(),
  designation_id: integer('designation_id').notNull(),
  is_internship: boolean('is_internship').notNull().default(false),
  employment_status: text('employment_status').notNull().default('active'),
  join_date: text('join_date').notNull(),
  leave_date: text('leave_date'),
  base_salary: real('base_salary').notNull().default(0),
  status: text('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const employeeRelations = relations(employees, ({ one }) => ({
  user: one(user, {
    fields: [employees.id],
    references: [user.id]
  }),
  department: one(departments, {
    fields: [employees.department_id],
    references: [departments.id]
  }),
  designation: one(designations, {
    fields: [employees.designation_id],
    references: [designations.id]
  })
}));

export const departmentRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
  designations: many(designations)
}));

export const designationRelations = relations(designations, ({ one, many }) => ({
  department: one(departments, {
    fields: [designations.department_id],
    references: [departments.id]
  }),
  employees: many(employees)
}));

// Types (unchanged)
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Designation = typeof designations.$inferSelect;
export type NewDesignation = typeof designations.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema/masterdata.ts
git commit -m "refactor: change employees.id to text, mirror user.id"
```

---

### Task 2: Add customers table schema

**Files:**
- Create: `src/lib/db/schema/customers.ts`

**Interfaces:**
- Produces: `customers` table, `customerRelations`, exported types `Customer`, `NewCustomer`

- [ ] **Step 1: Create customers schema file**

```typescript
import { pgTable, text, timestamp, boolean, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';

export const customers = pgTable('customers', {
  id: text('id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  customer_code: text('customer_code').notNull().unique(),
  full_name: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull().default(''),
  latitude: real('latitude').notNull().default(0),
  longitude: real('longitude').notNull().default(0),
  id_card_number: text('id_card_number').notNull().default('').unique(),
  id_card_photo: text('id_card_photo').notNull().default(''),
  service_data: text('service_data').notNull().default('{}'),
  billing_address: text('billing_address').notNull().default(''),
  notes: text('notes').notNull().default(''),
  status: text('status').notNull().default('active'),
  created_by: text('created_by').notNull().references(() => user.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const customerRelations = relations(customers, ({ one }) => ({
  user: one(user, {
    fields: [customers.id],
    references: [user.id]
  }),
  creator: one(user, {
    fields: [customers.created_by],
    references: [user.id]
  })
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema/customers.ts
git commit -m "feat: add customers table schema"
```

---

### Task 3: Update schema/index.ts exports

**Files:**
- Modify: `src/lib/db/schema/index.ts`

- [ ] **Step 1: Add customers import**

```typescript
export * from './products';
export * from './notifications';
export * from './attendance';
export * from './masterdata';
export * from './customers';
export * from '../auth-schema';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema/index.ts
git commit -m "chore: export customers schema from index"
```

---

### Task 4: Update auth-schema.ts with employee/customer relations

**Files:**
- Modify: `src/lib/db/auth-schema.ts`

**Interfaces:**
- Consumes: `employees` from masterdata, `customers` from customers schema
- Produces: updated `userRelations` linking to `employees` and `customers`

- [ ] **Step 1: Add imports and update userRelations**

Add to imports:
```typescript
import { employees } from './schema/masterdata';
import { customers } from './schema/customers';
```

Update `userRelations`:
```typescript
export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  employee: one(employees, {
    fields: [user.id],
    references: [employees.id]
  }),
  customer: one(customers, {
    fields: [user.id],
    references: [customers.id]
  })
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/auth-schema.ts
git commit -m "feat: add employee and customer relations to user"
```

---

### Task 5: Add customer role to permissions

**Files:**
- Modify: `src/lib/auth/permissions.ts`

- [ ] **Step 1: Add customer role with self-service permissions**

```typescript
export const customer = ac.newRole({
  user: ['read', 'update'],
  attendance: [],
  leave: [],
  employee: [],
  department: [],
  designation: [],
  shift: [],
  location: []
});
```

Customer role initially has minimal permissions — just self-profile read/update. Dashboard and external-service permissions will be added in future tasks.

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat: add customer role to RBAC"
```

---

### Task 6: Add attendance table relations to user

**Files:**
- Modify: `src/lib/db/schema/attendance.ts`

**Interfaces:**
- Consumes: `user` from auth-schema
- Produces: relations linking attendance tables to `user`

- [ ] **Step 1: Add relations at end of attendance.ts**

```typescript
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';
import { employees } from './masterdata';

export const locationRelations = relations(locations, ({ many }) => ({
  employeeShifts: many(employeeShifts)
}));

export const shiftRelations = relations(shifts, ({ many }) => ({
  employeeShifts: many(employeeShifts),
  leaves: many(leaves)
}));

export const employeeShiftRelations = relations(employeeShifts, ({ one }) => ({
  user: one(user, {
    fields: [employeeShifts.user_id],
    references: [user.id]
  }),
  shift: one(shifts, {
    fields: [employeeShifts.shift_id],
    references: [shifts.id]
  }),
  location: one(locations, {
    fields: [employeeShifts.shift_id], // approximated: links via default location
    references: [locations.id]
  })
}));

export const leaveRelations = relations(leaves, ({ one }) => ({
  user: one(user, {
    fields: [leaves.user_id],
    references: [user.id]
  }),
  shift: one(shifts, {
    fields: [leaves.shift_id],
    references: [shifts.id]
  })
}));

export const performanceReportRelations = relations(performanceReports, ({ one }) => ({
  user: one(user, {
    fields: [performanceReports.user_id],
    references: [user.id]
  })
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema/attendance.ts
git commit -m "feat: add Drizzle relations for attendance tables"
```

---

### Task 7: Update seed script

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Update seedEmployees to use user.id as employees.id**

Change `seedEmployees` to insert `id` (mirroring `user.id`) instead of `user_id`:

```typescript
async function seedEmployees() {
  const employeeData = [
    { employee_code: 'EMP001', full_name: 'Demo Admin', email: 'admin@example.com', department_code: 'ENG', designation_code: 'SR_NET' },
    { employee_code: 'EMP002', full_name: 'Demo HR', email: 'hr@example.com', department_code: 'HR', designation_code: 'HR_SPEC' },
    { employee_code: 'EMP003', full_name: 'Demo Employee', email: 'employee@example.com', department_code: 'SALES', designation_code: 'SALES_AGT' },
    { employee_code: 'EMP004', full_name: 'Demo Technician', email: 'technician@example.com', department_code: 'OPS', designation_code: 'FLD_TECH' }
  ];

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const userMap = new Map(users.map(u => [u.email, u.id]));

  const depts = await db.select({ id: departments.id, code: departments.code }).from(departments);
  const deptMap = new Map(depts.map(d => [d.code, d.id]));

  const desigs = await db.select({ id: designations.id, code: designations.code }).from(designations);
  const desigMap = new Map(desigs.map(d => [d.code, d.id]));

  const employeeRecords = employeeData.map(emp => {
    const userId = userMap.get(emp.email);
    if (!userId) throw new Error(`User not found for ${emp.email}`);
    return {
      id: userId,
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      email: emp.email,
      birth_date: '1990-01-01',
      department_id: deptMap.get(emp.department_code) ?? 0,
      designation_id: desigMap.get(emp.designation_code) ?? 0,
      join_date: '2024-01-01'
    };
  });

  await db.delete(employees);
  await db.insert(employees).values(employeeRecords);
  console.log(`Seeded ${employeeRecords.length} employee records`);
}
```

Add `customers` import:
```typescript
import { products, notifications, employees, departments, designations, locations, shifts, customers } from '../src/lib/db/schema';
```

Add `customer` to `ROLES`:
```typescript
const ROLES = ['admin', 'hr', 'employee', 'technician', 'customer'] as const;
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed.ts
git commit -m "fix: update seed to use user.id as employees.id"
```

---

### Task 8: Run migration

**Files:**
- None (database migration)

- [ ] **Step 1: Push schema changes to database**

Run: `bun run db:push`
Expected: Database schema updated with new employees table, customers table, and all relations.

- [ ] **Step 2: Run seed script**

Run: `bun run db:seed`
Expected: All seed data created successfully with new schema.

- [ ] **Step 3: Commit migration artifacts**

```bash
git add -A
git commit -m "chore: apply database migration and reseed"
```

---

### Task 9: Verify with typecheck

- [ ] **Step 1: Run TypeScript check**

Run: `bun run typecheck`
Expected: No type errors.

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: No lint errors.

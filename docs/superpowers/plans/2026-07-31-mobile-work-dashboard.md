# Mobile Work Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the attendance-first mobile home with a driver-style work dashboard (assigned tasks first, eligibility-gated available jobs pool), fix bottom navigation (Home | My Work | Attendance | Leave | Profile, FAB → attendance shortcut), add a profile screen, and make attendance/leave screens mobile-native.

**Architecture:** New `tasks` domain (Drizzle schema + data access with eligibility + server functions + React Query) following the existing `attendance` feature pattern exactly. Home screen composes task sections in `staff-mobile-dashboard.tsx`. Bottom nav becomes a pure 5-tab `<Link>` nav with a no-op mutation-free FAB. Eligibility is enforced server-side in `takeTask` (transactional claim); the client only renders server-filtered results. Spec: `docs/superpowers/specs/2026-07-31-mobile-work-dashboard-design.md`.

**Tech Stack:** TanStack Start (server functions), Drizzle ORM + PostgreSQL, TanStack Query + Router, Tailwind v4, shadcn/ui, motion.

## Global Constraints

- Follow the attendance feature pattern exactly: server fns use `requireRole('employee')` + `checkRateLimit` + `withRequestContext` + dynamic `import('@/lib/db/...')`; DB layer wraps every handler in try/catch with `mapDbError(e, 'tasks.<fn>')`; responses are `{ success, ... }` objects.
- English-only user-facing copy (repo convention, per spec/audit).
- Never render a `Take` button on ineligible tasks; ineligible tasks only appear in the "Not available for you" list with reasons.
- No hardcoded performance numbers — the performance card renders nothing when the API returns no reports.
- FAB and nav items are `<Link>`s; icon-only buttons need `aria-label`.
- Do not modify `package.json` further (author field removal already done, leave uncommitted) or touch the pre-existing `docs/CHANGELOG.md` working-tree changes except in Task 10.
- Verify per task with `bun run typecheck` (and `bun run lint` where code changed); full gates `bun run lint && bun run typecheck && bun run test:run && bun run build` before the final task.
- Commit after each task; stage only files listed in that task.
- Dates via `Intl.DateTimeFormat`/`toLocaleDateString`; counts/durations use `tabular-nums`.
- Route tree is auto-generated: after creating routes (Task 5), regenerate with `timeout 20 bun run dev || true` before typecheck.

---

### Task 1: Tasks DB Schema + `employees.location_id`

**Files:**
- Create: `src/lib/db/schema/tasks.ts`
- Modify: `src/lib/db/schema/masterdata.ts` (add `location_id` to `employees` + relation)
- Modify: `src/lib/db/schema/index.ts` (export tasks schema)
- Modify: `drizzle.config.ts` (add tasks schema to list)

**Interfaces:**
- Produces: `tasks`, `taskRequirements`, `employeeSkills` tables with `taskStatusEnum`, `taskPriorityEnum`; `employees.location_id: integer?` FK → `locations.id`; `Employee.location_id` on the row type.

- [ ] **Step 1: Create `src/lib/db/schema/tasks.ts`**

```ts
import { pgEnum, pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';
import { locations } from './attendance';
import { departments, designations } from './masterdata';

export const taskStatusEnum = pgEnum('task_status', [
  'assigned',
  'available',
  'in_progress',
  'completed',
  'cancelled'
]);

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high']);

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  task_type: text('task_type').notNull().default('general'),
  status: taskStatusEnum('status').notNull().default('available'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  location_id: integer('location_id').references(() => locations.id),
  due_at: timestamp('due_at'),
  estimated_minutes: integer('estimated_minutes'),
  assigned_to: text('assigned_to').references(() => user.id),
  taken_by: text('taken_by').references(() => user.id),
  taken_at: timestamp('taken_at'),
  completed_at: timestamp('completed_at'),
  created_by: text('created_by')
    .notNull()
    .references(() => user.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const taskRequirements = pgTable('task_requirements', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  department_id: integer('department_id').references(() => departments.id),
  designation_id: integer('designation_id').references(() => designations.id),
  location_id: integer('location_id').references(() => locations.id),
  skill: text('skill')
});

export const employeeSkills = pgTable(
  'employee_skills',
  {
    id: serial('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (t) => [uniqueIndex('employee_skills_user_skill_unique').on(t.user_id, t.skill)]
);

export const taskRelations = relations(tasks, ({ one, many }) => ({
  location: one(locations, {
    fields: [tasks.location_id],
    references: [locations.id]
  }),
  assignedUser: one(user, {
    fields: [tasks.assigned_to],
    references: [user.id]
  }),
  takenUser: one(user, {
    fields: [tasks.taken_by],
    references: [user.id]
  }),
  requirements: many(taskRequirements)
}));

export const taskRequirementRelations = relations(taskRequirements, ({ one }) => ({
  task: one(tasks, {
    fields: [taskRequirements.task_id],
    references: [tasks.id]
  })
}));

export const employeeSkillRelations = relations(employeeSkills, ({ one }) => ({
  user: one(user, {
    fields: [employeeSkills.user_id],
    references: [user.id]
  })
}));

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskRequirement = typeof taskRequirements.$inferSelect;
export type EmployeeSkill = typeof employeeSkills.$inferSelect;
```

Note: `uniqueIndex` must be imported from `drizzle-orm/pg-core` — add it to the import list:

```ts
import { pgEnum, pgTable, serial, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
```

- [ ] **Step 2: Add `location_id` to `employees` in `src/lib/db/schema/masterdata.ts`**

Add the import (top of file, after `import { user } from '../auth-schema';`):

```ts
import { locations } from './attendance';
```

Add the column after `designation_id` (line ~49) and a relation. Column:

```ts
  designation_id: integer('designation_id').notNull(),
  location_id: integer('location_id').references(() => locations.id),
```

Add to `employeeRelations` (after the `designation` relation):

```ts
  location: one(locations, {
    fields: [employees.location_id],
    references: [locations.id]
  })
```

- [ ] **Step 3: Export the new schema**

In `src/lib/db/schema/index.ts`, add after the masterdata export:

```ts
export * from './tasks';
```

In `drizzle.config.ts`, add to the `schema` array:

```ts
    './src/lib/db/schema/tasks.ts',
```

- [ ] **Step 4: Generate and apply the migration**

Run:
```bash
bun run db:generate
```
Expected: generates a new SQL migration under `src/lib/db/migrations/` containing `task_status`, `task_priority` enums, `tasks`, `task_requirements`, `employee_skills` tables, and an `ALTER TABLE employees ADD COLUMN location_id`.

Then:
```bash
bun run db:migrate:run
```
Expected: applies the migration; prints the applied migration name.

- [ ] **Step 5: Verify types**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema/tasks.ts src/lib/db/schema/masterdata.ts src/lib/db/schema/index.ts drizzle.config.ts src/lib/db/migrations
git commit -m "feat: add tasks schema and employees.location_id"
```

---

### Task 2: Task Data Access with Eligibility + Integration Tests

**Files:**
- Create: `src/lib/db/tasks.ts`
- Create: `src/lib/db/tasks.test.ts`
- Modify: `src/test-utils/db.ts` (reset + seed helpers)

**Interfaces:**
- Consumes: tables from `./schema/tasks`, `./schema/masterdata`, `./schema/attendance`; types from `@/features/tasks/api/types` (Task 3 defines them — copy the exact shapes below into Task 3 unchanged).
- Produces:
  - `MAX_ACTIVE_TASKS = 3`
  - `getMyTasks(userId: string): Promise<MyTasksResponse>` — assigned_to or taken_by me, status assigned/in_progress, `desc(created_at)`
  - `getAvailableTasks(userId: string, filters: AvailableTaskFilters): Promise<AvailableTasksResponse>` — eligible `available` tasks + `unavailable` array with `eligibilityReasons`
  - `getTaskDetail(userId: string, taskId: number): Promise<TaskDetailResponse>` — only own tasks
  - `takeTask(userId: string, taskId: number): Promise<TaskActionResponse>` — transactional claim
  - `completeTask(userId: string, taskId: number): Promise<TaskActionResponse>`

Task object shape produced by `toTask` (used by all functions):

```ts
{
  id: number;
  title: string;
  description: string;
  task_type: string;
  status: 'assigned' | 'available' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  location: { id: number; name: string } | null;
  dueAt: string | null;          // ISO string or null
  estimatedMinutes: number | null;
  requiredSkills: string[];
  assignedTo: string | null;
  takenBy: string | null;
}
```

- [ ] **Step 1: Write the failing tests — `src/lib/db/tasks.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getMyTasks, getAvailableTasks, getTaskDetail, takeTask, completeTask, MAX_ACTIVE_TASKS } from './tasks';
import { db } from '@/lib/db';
import { tasks } from './schema/tasks';
import {
  resetAllTables,
  seedUser,
  seedDepartment,
  seedDesignation,
  seedLocation,
  seedEmployee,
  seedTask,
  seedTaskRequirement,
  seedEmployeeSkill
} from '@/test-utils/db';

const USER_A = 'task-user-a';
const USER_B = 'task-user-b';

describe('tasks data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('getMyTasks', () => {
    it('returns empty when user has no tasks', async () => {
      const res = await getMyTasks(USER_A);
      expect(res.success).toBe(true);
      expect(res.tasks).toHaveLength(0);
    });

    it('returns assigned and in-progress tasks for the user only', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      await seedTask({ title: 'Mine assigned', assigned_to: USER_A, status: 'assigned', created_by: 'seed' });
      await seedTask({ title: 'Mine in progress', taken_by: USER_A, status: 'in_progress', created_by: 'seed' });
      await seedTask({ title: 'Not mine', assigned_to: USER_B, status: 'assigned', created_by: 'seed' });
      await seedTask({ title: 'Pool only', status: 'available', created_by: 'seed' });

      const res = await getMyTasks(USER_A);
      expect(res.success).toBe(true);
      expect(res.tasks).toHaveLength(2);
      expect(res.tasks.map((t) => t.title).sort()).toEqual(['Mine assigned', 'Mine in progress']);
    });
  });

  describe('getAvailableTasks', () => {
    it('returns only tasks whose requirements match the user', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      await seedEmployeeSkill(USER_A, 'Fiber Optic');

      const matching = await seedTask({ title: 'Match', status: 'available', created_by: 'seed' });
      await seedTaskRequirement(matching.id, { designation_id: designation.id, skill: 'Fiber Optic' });

      const wrongDept = await seedTask({ title: 'Wrong dept', status: 'available', created_by: 'seed' });
      const otherDept = await seedDepartment({ name: 'Finance', code: 'FIN' });
      await seedTaskRequirement(wrongDept.id, { department_id: otherDept.id });

      const noSkill = await seedTask({ title: 'No skill', status: 'available', created_by: 'seed' });
      await seedTaskRequirement(noSkill.id, { skill: 'Networking' });

      const res = await getAvailableTasks(USER_A, {});
      expect(res.success).toBe(true);
      expect(res.tasks.map((t) => t.title)).toEqual(['Match']);
      expect(res.unavailable.map((t) => t.title).sort()).toEqual(['No skill', 'Wrong dept']);
      expect(res.unavailable.find((t) => t.title === 'No skill')?.eligibilityReasons).toContain(
        'Requires skill: Networking'
      );
    });

    it('respects location and designation requirements', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      const otherLoc = await seedLocation({ name: 'Other Branch' });

      const locTask = await seedTask({ title: 'Loc match', status: 'available', created_by: 'seed' });
      await seedTaskRequirement(locTask.id, { location_id: location.id });

      const locMiss = await seedTask({ title: 'Loc miss', status: 'available', created_by: 'seed' });
      await seedTaskRequirement(locMiss.id, { location_id: otherLoc.id });

      const desigMiss = await seedTask({ title: 'Desig miss', status: 'available', created_by: 'seed' });
      const otherDesig = await seedDesignation(department.id, { name: 'Analyst', code: 'ANL' });
      await seedTaskRequirement(desigMiss.id, { designation_id: otherDesig.id });

      const res = await getAvailableTasks(USER_A, {});
      expect(res.tasks.map((t) => t.title)).toEqual(['Loc match']);
      expect(res.unavailable.map((t) => t.title).sort()).toEqual(['Desig miss', 'Loc miss']);
    });

    it('filters by priority and location when filters are passed', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      await seedTask({ title: 'High loc', status: 'available', priority: 'high', location_id: location.id, created_by: 'seed' });
      await seedTask({ title: 'Low loc', status: 'available', priority: 'low', location_id: location.id, created_by: 'seed' });

      const res = await getAvailableTasks(USER_A, { locationId: location.id, priority: 'high' });
      expect(res.tasks.map((t) => t.title)).toEqual(['High loc']);
    });
  });

  describe('getTaskDetail', () => {
    it('returns only tasks owned by the user', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const mine = await seedTask({ title: 'Mine', assigned_to: USER_A, status: 'assigned', created_by: 'seed' });
      const notMine = await seedTask({ title: 'Not mine', assigned_to: USER_B, status: 'assigned', created_by: 'seed' });

      const ok = await getTaskDetail(USER_A, mine.id);
      expect(ok.success).toBe(true);
      expect(ok.task?.title).toBe('Mine');

      const denied = await getTaskDetail(USER_A, notMine.id);
      expect(denied.success).toBe(false);
    });
  });

  describe('takeTask', () => {
    it('claims an eligible available task', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      const task = await seedTask({ title: 'Pool task', status: 'available', created_by: 'seed' });

      const res = await takeTask(USER_A, task.id);
      expect(res.success).toBe(true);
      expect(res.task?.status).toBe('in_progress');
      expect(res.task?.takenBy).toBe(USER_A);

      const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
      expect(row!.status).toBe('in_progress');
      expect(row!.taken_by).toBe(USER_A);
    });

    it('rejects a task the user is not eligible for', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      const otherDept = await seedDepartment({ name: 'Finance', code: 'FIN' });
      const task = await seedTask({ title: 'Wrong dept', status: 'available', created_by: 'seed' });
      await seedTaskRequirement(task.id, { department_id: otherDept.id });

      const res = await takeTask(USER_A, task.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Not eligible');
    });

    it('rejects a task that is no longer available', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const task = await seedTask({ title: 'Taken', status: 'available', created_by: 'seed' });

      const first = await takeTask(USER_A, task.id);
      expect(first.success).toBe(true);

      const second = await takeTask(USER_B, task.id);
      expect(second.success).toBe(false);
      expect(second.message).toBe('Task is no longer available');
    });

    it('yields exactly one winner under concurrent claims', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const task = await seedTask({ title: 'Race', status: 'available', created_by: 'seed' });

      const [r1, r2] = await Promise.allSettled([takeTask(USER_A, task.id), takeTask(USER_B, task.id)]);
      const winners = [r1, r2].filter(
        (r): r is PromiseFulfilledResult<{ success: boolean }> => r.status === 'fulfilled' && r.value.success
      );
      expect(winners).toHaveLength(1);
    });

    it('rejects when the user is at the active task limit', async () => {
      const { employee, department, designation, location } = await seedEmployee(USER_A);
      for (let i = 0; i < MAX_ACTIVE_TASKS; i++) {
        await seedTask({ title: `Active ${i}`, assigned_to: USER_A, status: 'assigned', created_by: 'seed' });
      }
      const poolTask = await seedTask({ title: 'Pool', status: 'available', created_by: 'seed' });

      const res = await takeTask(USER_A, poolTask.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Active task limit reached');
    });
  });

  describe('completeTask', () => {
    it('completes an in-progress task owned by the caller', async () => {
      await seedEmployee(USER_A);
      const task = await seedTask({ title: 'Doing', status: 'available', created_by: 'seed' });
      await takeTask(USER_A, task.id);

      const res = await completeTask(USER_A, task.id);
      expect(res.success).toBe(true);
      expect(res.task?.status).toBe('completed');

      const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
      expect(row!.status).toBe('completed');
      expect(row!.completed_at).not.toBeNull();
    });

    it('rejects completing a task not taken by the caller', async () => {
      await seedEmployee(USER_A);
      await seedEmployee(USER_B);
      const task = await seedTask({ title: 'Doing', status: 'available', created_by: 'seed' });
      await takeTask(USER_B, task.id);

      const res = await completeTask(USER_A, task.id);
      expect(res.success).toBe(false);
    });
  });
});
```

Note: the tests above use `eq` from `drizzle-orm` — add the import at the top of the test file:

```ts
import { eq } from 'drizzle-orm';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:run src/lib/db/tasks.test.ts`
Expected: FAIL — module `./tasks` not found; helpers `seedEmployee`, `seedTask`, `seedTaskRequirement`, `seedEmployeeSkill` not exported from `@/test-utils/db`.

- [ ] **Step 3: Add test-utils helpers to `src/test-utils/db.ts`**

Add imports (replace the existing masterdata/attendance imports):

```ts
import { departments, designations, employees } from '@/lib/db/schema/masterdata';
import { tasks, taskRequirements, employeeSkills } from '@/lib/db/schema/tasks';
```

(Keep the existing `user` import; `locations` is already imported.)

Add these tables to `resetAllTables` — after `performanceReports` and before `employees` (FK order matters):

```ts
  await db.delete(employeeSkills);
  await db.delete(taskRequirements);
  await db.delete(tasks);
```

Append the new helpers at the end of the file:

```ts
let taskCreatorSeq = 0;

export async function seedEmployee(userId: string, overrides: Partial<typeof employees.$inferInsert> = {}) {
  const dept = await seedDepartment();
  const desig = await seedDesignation(dept.id);
  const loc = await seedLocation();
  const [employee] = await db
    .insert(employees)
    .values({
      id: userId,
      employee_code: `EMP-${userId}`,
      full_name: 'Test Employee',
      email: `${userId}@test.com`,
      birth_date: '1990-01-01',
      department_id: dept.id,
      designation_id: desig.id,
      location_id: loc.id,
      join_date: '2024-01-01',
      ...overrides
    })
    .returning();
  return { employee, department: dept, designation: desig, location: loc };
}

export async function seedTask(overrides: Partial<typeof tasks.$inferInsert> = {}) {
  const { created_by, ...rest } = overrides;
  let createdBy = created_by;
  if (!createdBy || createdBy === 'seed') {
    createdBy = `task-creator-${++taskCreatorSeq}`;
    await seedUser(createdBy, { role: 'admin' });
  }
  const [task] = await db
    .insert(tasks)
    .values({
      title: 'Test Task',
      description: '',
      status: 'available',
      priority: 'medium',
      created_by: createdBy,
      ...rest
    })
    .returning();
  return task;
}

export async function seedTaskRequirement(taskId: number, overrides: Partial<typeof taskRequirements.$inferInsert> = {}) {
  const [req] = await db
    .insert(taskRequirements)
    .values({ task_id: taskId, ...overrides })
    .returning();
  return req;
}

export async function seedEmployeeSkill(userId: string, skill: string) {
  await db.insert(employeeSkills).values({ user_id: userId, skill });
}
```

Note: the test file calls `seedTask({ ..., created_by: 'seed' })` and `seedTask({ ..., assigned_to: USER_A, created_by: 'seed' })` — the `created_by: 'seed'` sentinel makes `seedTask` create a fresh creator user internally so the FK is satisfied. When `created_by` is not `'seed'`, its value is used directly.

- [ ] **Step 4: Create `src/lib/db/tasks.ts`**

```ts
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { tasks, taskRequirements, employeeSkills } from './schema/tasks';
import { employees } from './schema/masterdata';
import { locations } from './schema/attendance';
import type {
  AvailableTaskFilters,
  AvailableTasksResponse,
  MyTasksResponse,
  TaskActionResponse,
  TaskDetailResponse
} from '@/features/tasks/api/types';

export const MAX_ACTIVE_TASKS = 3;

type TaskRow = typeof tasks.$inferSelect;
type RequirementRow = typeof taskRequirements.$inferSelect;

async function toTask(row: TaskRow, reqs: RequirementRow[]) {
  let location: { id: number; name: string } | null = null;
  if (row.location_id != null) {
    const [loc] = await db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(eq(locations.id, row.location_id))
      .limit(1);
    location = loc ?? null;
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    task_type: row.task_type,
    status: row.status,
    priority: row.priority,
    location,
    dueAt: row.due_at ? row.due_at.toISOString() : null,
    estimatedMinutes: row.estimated_minutes,
    requiredSkills: reqs.map((r) => r.skill).filter((s): s is string => s != null),
    assignedTo: row.assigned_to,
    takenBy: row.taken_by
  };
}

async function loadRequirements(taskId: number): Promise<RequirementRow[]> {
  return db.select().from(taskRequirements).where(eq(taskRequirements.task_id, taskId));
}

async function getEligibilityProfile(userId: string) {
  const [employee, skillRows] = await Promise.all([
    db.select().from(employees).where(eq(employees.id, userId)).limit(1),
    db.select({ skill: employeeSkills.skill }).from(employeeSkills).where(eq(employeeSkills.user_id, userId))
  ]);
  return {
    employee: employee[0] ?? null,
    skills: skillRows.map((r) => r.skill)
  };
}

function unmetReasons(reqs: RequirementRow[], profile: Awaited<ReturnType<typeof getEligibilityProfile>>): string[] {
  const reasons: string[] = [];
  for (const r of reqs) {
    if (r.department_id != null && profile.employee?.department_id !== r.department_id) {
      reasons.push('Requires a different department');
    }
    if (r.designation_id != null && profile.employee?.designation_id !== r.designation_id) {
      reasons.push('Requires a different designation');
    }
    if (r.location_id != null && profile.employee?.location_id !== r.location_id) {
      reasons.push('Outside your assigned location');
    }
    if (r.skill != null && !profile.skills.includes(r.skill)) {
      reasons.push(`Requires skill: ${r.skill}`);
    }
  }
  return [...new Set(reasons)];
}

function isMine(userId: string): ReturnType<typeof sql> {
  return sql`(${tasks.assigned_to} = ${userId} OR ${tasks.taken_by} = ${userId})`;
}

export async function getMyTasks(userId: string): Promise<MyTasksResponse> {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(inArray(tasks.status, ['assigned', 'in_progress']), isMine(userId)))
      .orderBy(desc(tasks.created_at));

    const result = [];
    for (const row of rows) {
      result.push(await toTask(row, await loadRequirements(row.id)));
    }
    return { success: true, tasks: result };
  } catch (e) {
    mapDbError(e, 'tasks.getMyTasks');
  }
}

export async function getAvailableTasks(
  userId: string,
  filters: AvailableTaskFilters = {}
): Promise<AvailableTasksResponse> {
  try {
    const profile = await getEligibilityProfile(userId);

    const conditions = [eq(tasks.status, 'available')];
    if (filters.locationId != null) conditions.push(eq(tasks.location_id, filters.locationId));
    if (filters.priority != null) conditions.push(eq(tasks.priority, filters.priority));
    const where = and(...conditions);

    const rows = await db.select().from(tasks).where(where).orderBy(desc(tasks.created_at));

    const eligible: AvailableTasksResponse['tasks'] = [];
    const unavailable: AvailableTasksResponse['unavailable'] = [];
    for (const row of rows) {
      const reqs = await loadRequirements(row.id);
      const task = await toTask(row, reqs);
      const reasons = unmetReasons(reqs, profile);
      if (reasons.length === 0) {
        eligible.push(task);
      } else {
        unavailable.push({ ...task, eligibilityReasons: reasons });
      }
    }
    return { success: true, tasks: eligible, unavailable };
  } catch (e) {
    mapDbError(e, 'tasks.getAvailableTasks');
  }
}

export async function getTaskDetail(userId: string, taskId: number): Promise<TaskDetailResponse> {
  try {
    const [row] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isMine(userId)))
      .limit(1);
    if (!row) return { success: false, message: 'Task not found' };
    return { success: true, task: await toTask(row, await loadRequirements(row.id)) };
  } catch (e) {
    mapDbError(e, 'tasks.getTaskDetail');
  }
}

export async function takeTask(userId: string, taskId: number): Promise<TaskActionResponse> {
  try {
    const result = await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.status, 'available')))
        .limit(1);
      if (!task) return { success: false, message: 'Task is no longer available' };

      const profile = await getEligibilityProfile(userId);
      const reqs = await loadRequirements(taskId);
      const reasons = unmetReasons(reqs, profile);
      if (reasons.length > 0) {
        return { success: false, message: `Not eligible: ${reasons.join(', ')}` };
      }

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(inArray(tasks.status, ['assigned', 'in_progress']), isMine(userId)));
      if (count >= MAX_ACTIVE_TASKS) {
        return { success: false, message: `Active task limit reached (${MAX_ACTIVE_TASKS})` };
      }

      const [claimed] = await tx
        .update(tasks)
        .set({ status: 'in_progress', taken_by: userId, taken_at: new Date(), updated_at: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.status, 'available')))
        .returning();
      if (!claimed) return { success: false, message: 'Task is no longer available' };

      return { success: true, message: 'Task taken', task: await toTask(claimed, reqs) };
    });
    return result;
  } catch (e) {
    mapDbError(e, 'tasks.takeTask');
  }
}

export async function completeTask(userId: string, taskId: number): Promise<TaskActionResponse> {
  try {
    const [task] = await db
      .update(tasks)
      .set({ status: 'completed', completed_at: new Date(), updated_at: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.taken_by, userId), eq(tasks.status, 'in_progress')))
      .returning();
    if (!task) return { success: false, message: 'Task not found or not in progress by you' };
    return { success: true, message: 'Task completed', task: await toTask(task, await loadRequirements(task.id)) };
  } catch (e) {
    mapDbError(e, 'tasks.completeTask');
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:run src/lib/db/tasks.test.ts`
Expected: FAIL (typecheck) — `@/features/tasks/api/types` does not exist yet. Create the types file now (it is Task 3's deliverable, but the tests need the types; see Task 3 Step 1 for the exact content, then re-run):

```bash
mkdir -p src/features/tasks/api
```

Create `src/features/tasks/api/types.ts` with the exact content from Task 3 Step 1, then run:

Run: `bun run test:run src/lib/db/tasks.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/tasks.ts src/lib/db/tasks.test.ts src/test-utils/db.ts src/features/tasks/api/types.ts
git commit -m "feat: add task data access with eligibility and claim semantics"
```

---

### Task 3: Tasks API Layer + Attendance Summary Server Function

**Files:**
- Create: `src/features/tasks/api/types.ts`
- Create: `src/features/tasks/api/validation.ts`
- Create: `src/features/tasks/api/service.ts`
- Create: `src/features/tasks/api/queries.ts`
- Create: `src/features/tasks/api/hooks.ts`
- Modify: `src/features/attendance/api/service.ts` (append `getAttendanceSummaryFn`)
- Modify: `src/features/attendance/api/queries.ts` (append `attendanceSummaryQueryOptions`)

**Interfaces:**
- Consumes: `getMyTasks`, `getAvailableTasks`, `getTaskDetail`, `takeTask`, `completeTask` from `@/lib/db/tasks`.
- Produces:
  - `getMyTasksFn`, `getAvailableTasksFn({ data: filters })`, `getTaskDetailFn({ data: { taskId } })`, `takeTaskFn({ data: { taskId } })`, `completeTaskFn({ data: { taskId } })` — all `createServerFn`
  - `myTasksQueryOptions()`, `availableTasksQueryOptions(filters)`, `taskDetailQueryOptions(taskId)`
  - `tasksKeys` (`all`, `mine`, `available`, `detail`)
  - `useTakeTask()`, `useCompleteTask()` mutation hooks (invalidate `tasksKeys.all`, toast on result)
  - `getAttendanceSummaryFn`, `attendanceSummaryQueryOptions()`

- [ ] **Step 1: Create `src/features/tasks/api/types.ts`**

```ts
export type TaskStatus = 'assigned' | 'available' | 'in_progress' | 'completed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high';

export type Task = {
  id: number;
  title: string;
  description: string;
  task_type: string;
  status: TaskStatus;
  priority: TaskPriority;
  location: { id: number; name: string } | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  requiredSkills: string[];
  assignedTo: string | null;
  takenBy: string | null;
};

export type UnavailableTask = Task & { eligibilityReasons: string[] };

export type MyTasksResponse = { success: boolean; tasks: Task[] };

export type AvailableTasksResponse = {
  success: boolean;
  tasks: Task[];
  unavailable: UnavailableTask[];
};

export type TaskActionResponse = { success: boolean; message?: string; task?: Task };

export type TaskDetailResponse = { success: boolean; task?: Task; message?: string };

export type AvailableTaskFilters = {
  locationId?: number;
  priority?: TaskPriority;
};
```

- [ ] **Step 2: Create `src/features/tasks/api/validation.ts`**

```ts
import { z } from 'zod';

export const taskIdSchema = z.object({
  taskId: z.number().int().positive()
});

export const availableTasksSchema = z.object({
  locationId: z.coerce.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});
```

- [ ] **Step 3: Create `src/features/tasks/api/service.ts`**

```ts
import { createServerFn } from '@tanstack/react-start';
import { requireRole } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequestContext } from '@/lib/request-id';
import { taskIdSchema, availableTasksSchema } from './validation';

export const getMyTasksFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    const session = await requireRole('employee');
    await checkRateLimit(`tasks:${session.user.id}`);
    const { getMyTasks } = await import('@/lib/db/tasks');
    return getMyTasks(session.user.id);
  })
);

export const getAvailableTasksFn = createServerFn({ method: 'GET' })
  .validator(availableTasksSchema)
  .handler(async ({ data: filters }) =>
    withRequestContext(async () => {
      const session = await requireRole('employee');
      await checkRateLimit(`tasks:${session.user.id}`);
      const { getAvailableTasks } = await import('@/lib/db/tasks');
      return getAvailableTasks(session.user.id, filters);
    })
  );

export const getTaskDetailFn = createServerFn({ method: 'GET' })
  .validator(taskIdSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('employee');
      const { getTaskDetail } = await import('@/lib/db/tasks');
      return getTaskDetail(session.user.id, data.taskId);
    })
  );

export const takeTaskFn = createServerFn({ method: 'POST' })
  .validator(taskIdSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('employee');
      await checkRateLimit(`tasks:${session.user.id}`);
      const { takeTask } = await import('@/lib/db/tasks');
      return takeTask(session.user.id, data.taskId);
    })
  );

export const completeTaskFn = createServerFn({ method: 'POST' })
  .validator(taskIdSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('employee');
      const { completeTask } = await import('@/lib/db/tasks');
      return completeTask(session.user.id, data.taskId);
    })
  );
```

- [ ] **Step 4: Create `src/features/tasks/api/queries.ts`**

```ts
import { queryOptions } from '@tanstack/react-query';
import { getMyTasksFn, getAvailableTasksFn, getTaskDetailFn } from './service';
import type { AvailableTaskFilters } from './types';

export const tasksKeys = {
  all: ['tasks'] as const,
  mine: () => [...tasksKeys.all, 'mine'] as const,
  available: (filters: AvailableTaskFilters) => [...tasksKeys.all, 'available', filters] as const,
  detail: (taskId: number) => [...tasksKeys.all, 'detail', taskId] as const
};

export const myTasksQueryOptions = () =>
  queryOptions({
    queryKey: tasksKeys.mine(),
    queryFn: () => getMyTasksFn()
  });

export const availableTasksQueryOptions = (filters: AvailableTaskFilters = {}) =>
  queryOptions({
    queryKey: tasksKeys.available(filters),
    queryFn: () => getAvailableTasksFn({ data: filters })
  });

export const taskDetailQueryOptions = (taskId: number) =>
  queryOptions({
    queryKey: tasksKeys.detail(taskId),
    queryFn: () => getTaskDetailFn({ data: { taskId } })
  });
```

- [ ] **Step 5: Create `src/features/tasks/api/hooks.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { takeTaskFn, completeTaskFn } from './service';
import { tasksKeys } from './queries';

export function useTakeTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => takeTaskFn({ data: { taskId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success('Task taken');
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
      } else {
        toast.error(res?.message ?? 'Failed to take task');
      }
    },
    onError: () => {
      toast.error('Failed to take task');
    }
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => completeTaskFn({ data: { taskId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success('Task completed');
        queryClient.invalidateQueries({ queryKey: tasksKeys.all });
      } else {
        toast.error(res?.message ?? 'Failed to complete task');
      }
    },
    onError: () => {
      toast.error('Failed to complete task');
    }
  });
}
```

- [ ] **Step 6: Append `getAttendanceSummaryFn` to `src/features/attendance/api/service.ts`**

Append at the end of the file:

```ts
export const getAttendanceSummaryFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    const session = await requireRole('employee');
    const { getAttendanceSummary } = await import('@/lib/db/attendance');
    return getAttendanceSummary(session.user.id);
  })
);
```

- [ ] **Step 7: Append `attendanceSummaryQueryOptions` to `src/features/attendance/api/queries.ts`**

Add `getAttendanceSummaryFn` to the existing import block, then append:

```ts
export const attendanceSummaryQueryOptions = () =>
  queryOptions({
    queryKey: [...attendanceKeys.all, 'summary'] as const,
    queryFn: () => getAttendanceSummaryFn()
  });
```

- [ ] **Step 8: Verify**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/features/tasks/api src/features/attendance/api/service.ts src/features/attendance/api/queries.ts
git commit -m "feat: add tasks server functions and attendance summary query"
```

---

### Task 4: Seed Demo Tasks + Employee Locations

**Files:**
- Modify: `scripts/seed.ts`

**Interfaces:**
- Consumes: `tasks`, `taskRequirements`, `employeeSkills` from `../src/lib/db/schema` (exported via `schema/index.ts`), `locations` (already imported).

- [ ] **Step 1: Update imports in `scripts/seed.ts`**

Replace the existing schema import line with:

```ts
import { products, notifications, employees, departments, designations, locations, shifts, customers, tasks, taskRequirements, employeeSkills } from '../src/lib/db/schema';
```

- [ ] **Step 2: Update `seedEmployees` to set locations**

Inside `seedEmployees`, after the existing `desigMap` block, add a location map:

```ts
  const locs = await db.select({ id: locations.id, name: locations.name }).from(locations);
  const locMap = new Map(locs.map((l) => [l.name, l.id]));
```

Add `location_id` to the employee record mapping (technician → Branch Office 1, employee → Head Office):

```ts
    return {
      id: userId,
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      email: emp.email,
      birth_date: '1990-01-01',
      department_id: deptMap.get(emp.department_code) ?? 0,
      designation_id: desigMap.get(emp.designation_code) ?? 0,
      location_id: emp.email === 'technician@example.com' ? (locMap.get('Branch Office 1') ?? null) : (locMap.get('Head Office') ?? null),
      join_date: '2024-01-01'
    };
```

- [ ] **Step 3: Add `seedTasks()`**

Append this function after `seedCustomers`:

```ts
async function seedTasks() {
  await db.delete(taskRequirements);
  await db.delete(employeeSkills);
  await db.delete(tasks);

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const adminId = byEmail.get('admin@example.com');
  const techId = byEmail.get('technician@example.com');
  const empId = byEmail.get('employee@example.com');
  if (!adminId || !techId || !empId) throw new Error('Demo users not found for tasks seed');

  const depts = await db.select({ id: departments.id, code: departments.code }).from(departments);
  const deptMap = new Map(depts.map((d) => [d.code, d.id]));
  const desigs = await db.select({ id: designations.id, code: designations.code }).from(designations);
  const desigMap = new Map(desigs.map((d) => [d.code, d.id]));
  const locs = await db.select({ id: locations.id, name: locations.name }).from(locations);
  const locMap = new Map(locs.map((l) => [l.name, l.id]));

  await db.insert(employeeSkills).values([
    { user_id: techId, skill: 'Fiber Optic' },
    { user_id: techId, skill: 'Networking' },
    { user_id: empId, skill: 'Customer Care' }
  ]);

  const due = (days: number) => new Date(Date.now() + days * 86400000);

  const [, t2, t3, t4, t5] = await db
    .insert(tasks)
    .values([
      {
        title: 'Fix network room 201',
        description: 'Switch port 12 is down — replace the faulty switch and verify link.',
        task_type: 'maintenance',
        status: 'assigned',
        priority: 'high',
        location_id: locMap.get('Branch Office 1') ?? null,
        due_at: due(1),
        estimated_minutes: 120,
        assigned_to: techId,
        created_by: adminId
      },
      {
        title: 'Install Fiber Router — Kemang',
        description: 'New customer install at Branch Office 1. Two-hour window.',
        task_type: 'installation',
        status: 'available',
        priority: 'high',
        location_id: locMap.get('Branch Office 1') ?? null,
        due_at: due(2),
        estimated_minutes: 120,
        created_by: adminId
      },
      {
        title: 'Network audit — Head Office',
        description: 'Monthly switch and cabling audit across the main floor.',
        task_type: 'audit',
        status: 'available',
        priority: 'medium',
        location_id: locMap.get('Head Office') ?? null,
        due_at: due(3),
        estimated_minutes: 240,
        created_by: adminId
      },
      {
        title: 'Fiber cable repair — corridor 3',
        description: 'Customer complaint: weak signal. Trace and repair the drop cable.',
        task_type: 'maintenance',
        status: 'available',
        priority: 'medium',
        location_id: locMap.get('Branch Office 1') ?? null,
        due_at: due(1),
        estimated_minutes: 90,
        created_by: adminId
      },
      {
        title: 'Customer visit follow-up',
        description: 'Follow up on the renewal quote sent to customer 7.',
        task_type: 'sales',
        status: 'available',
        priority: 'low',
        location_id: locMap.get('Head Office') ?? null,
        due_at: due(4),
        estimated_minutes: 60,
        created_by: adminId
      }
    ])
    .returning();

  await db.insert(taskRequirements).values([
    { task_id: t2.id, designation_id: desigMap.get('FLD_TECH'), skill: 'Fiber Optic' },
    { task_id: t3.id, department_id: deptMap.get('ENG'), skill: 'Networking' },
    { task_id: t4.id, designation_id: desigMap.get('FLD_TECH') },
    { task_id: t5.id, department_id: deptMap.get('SALES'), skill: 'Customer Care' }
  ]);

  console.log('Seeded 5 tasks, 4 task requirements, 3 employee skills');
}
```

- [ ] **Step 4: Call `seedTasks()` in `main()`**

In `main()`, after `await seedCustomers();` add:

```ts
  await seedTasks();
```

- [ ] **Step 5: Run the seed**

Run: `bun run db:seed`
Expected: output includes `Seeded 4 employee records`, `Seeded 5 tasks, 4 task requirements, 3 employee skills`, `Seed complete`.

- [ ] **Step 6: Verify**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: seed demo tasks with eligibility requirements"
```

---

### Task 5: Routes — My Work, Jobs, Profile

**Files:**
- Create: `src/routes/dashboard/my-work/index.tsx`
- Create: `src/routes/dashboard/jobs/index.tsx`
- Create: `src/routes/dashboard/profile.tsx`

**Interfaces:**
- Consumes: `MyWorkPage`, `JobsPage` (Task 7), `ProfilePage` (Task 8). Register imports now; components arrive in later tasks — to keep typecheck green, create the routes referencing components that exist. Workaround: complete Task 5 together with Task 7/8 component creation, or create the routes last. Order change: create the page components first (Task 7/8), then routes (Task 5) — or simply create minimal placeholder components in this task and fill them in Tasks 7–8.

Recommendation: in this task create the routes with imports; then immediately create the three page components as minimal stubs (heading text only) so typecheck passes; Tasks 7 and 8 replace the stubs with real implementations.

- [ ] **Step 1: Create the three route files**

`src/routes/dashboard/my-work/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import MyWorkPage from '@/features/tasks/components/my-work-page';

export const Route = createFileRoute('/dashboard/my-work/')({
  head: () => ({ meta: [{ title: 'Dashboard: My Work' }] }),
  component: () => <MyWorkPage />
});
```

`src/routes/dashboard/jobs/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import JobsPage from '@/features/tasks/components/jobs-page';

const jobsSearchSchema = z.object({
  locationId: z.coerce.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

export const Route = createFileRoute('/dashboard/jobs/')({
  head: () => ({ meta: [{ title: 'Dashboard: Available Jobs' }] }),
  validateSearch: zodValidator(jobsSearchSchema),
  component: JobsPage
});
```

`src/routes/dashboard/profile.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import ProfilePage from '@/features/profile/components/profile-page';

export const Route = createFileRoute('/dashboard/profile')({
  head: () => ({ meta: [{ title: 'Dashboard: Profile' }] }),
  component: () => <ProfilePage />
});
```

- [ ] **Step 2: Create minimal stubs so typecheck passes**

`src/features/tasks/components/my-work-page.tsx`:

```tsx
export default function MyWorkPage() {
  return <div className='p-4'>My Work</div>;
}
```

`src/features/tasks/components/jobs-page.tsx`:

```tsx
export default function JobsPage() {
  return <div className='p-4'>Available Jobs</div>;
}
```

`src/features/profile/components/profile-page.tsx`:

```tsx
export default function ProfilePage() {
  return <div className='p-4'>Profile</div>;
}
```

- [ ] **Step 3: Regenerate the route tree and verify**

```bash
timeout 20 bun run dev || true
bun run typecheck
```

Expected: route tree regenerated; no typecheck errors. (If `timeout` is unavailable, start `bun run dev`, wait ~10s for "ready", then stop it with Ctrl+C.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/dashboard/my-work src/routes/dashboard/jobs src/routes/dashboard/profile.tsx src/features/tasks/components/my-work-page.tsx src/features/tasks/components/jobs-page.tsx src/features/profile/components/profile-page.tsx src/routeTree.gen.ts
git commit -m "feat: add my-work, jobs, and profile routes"
```

---

### Task 6: Bottom Navigation — 5 Tabs, FAB as Attendance Shortcut

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx` (rewrite)
- Modify: `src/components/layout/mobile-shell.tsx` (safe-area bottom padding)

**Interfaces:**
- Consumes: nothing new.
- Produces: nav with tabs Home (`/dashboard/overview`), My Work (`/dashboard/my-work`), Attendance (`/dashboard/attendance`), Leave (`/dashboard/leave`), Profile (`/dashboard/profile`); FAB is a `<Link>` to `/dashboard/attendance` with `aria-label`.

- [ ] **Step 1: Rewrite `src/components/layout/bottom-nav.tsx`**

```tsx
import { Link, useLocation } from '@tanstack/react-router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Icons } from '@/components/icons';

const navItems = [
  { icon: Icons.dashboard, label: 'Home', to: '/dashboard/overview' },
  { icon: Icons.workspace, label: 'My Work', to: '/dashboard/my-work' },
  { icon: Icons.clock, label: 'Attendance', to: '/dashboard/attendance' },
  { icon: Icons.calendar, label: 'Leave', to: '/dashboard/leave' },
  { icon: Icons.user, label: 'Profile', to: '/dashboard/profile' }
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <motion.nav
      initial={{ y: 60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className='bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-lg'
    >
      <Link
        to='/dashboard/attendance'
        aria-label='Go to attendance'
        className='bg-primary text-primary-foreground absolute -top-6 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full shadow-lg'
      >
        {reduceMotion ? (
          <Icons.clock className='h-5 w-5' />
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
            >
              <Icons.clock className='h-5 w-5' />
            </motion.div>
          </AnimatePresence>
        )}
      </Link>

      <div className='mx-auto flex max-w-lg items-center justify-around py-2'>
        {navItems.map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
          return (
            <Link
              key={item.to}
              to={item.to}
              className='flex touch-manipulation flex-col items-center gap-0.5 px-3 py-1'
            >
              <item.icon
                className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span
                className={`text-[10px] ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
```

- [ ] **Step 2: Update `src/components/layout/mobile-shell.tsx`**

```tsx
import { Outlet } from '@tanstack/react-router';
import { MobileHeader } from './mobile-header';
import { BottomNav } from './bottom-nav';

export function MobileShell() {
  return (
    <div className='mx-auto min-h-screen max-w-lg bg-background'>
      <MobileHeader />
      <main className='pb-[calc(5rem+env(safe-area-inset-bottom))]'>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `bun run typecheck && bun run lint`
Expected: no errors. Note: `useReducedMotion` returns `boolean | null` — `reduceMotion ? ...` handles null correctly (no animation when unknown, acceptable).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/bottom-nav.tsx src/components/layout/mobile-shell.tsx
git commit -m "feat: rework bottom nav to five tabs with attendance shortcut FAB"
```

---

### Task 7: Task UI Components + Home Rework

**Files:**
- Create: `src/features/tasks/components/task-card.tsx`
- Create: `src/features/tasks/components/my-work-section.tsx`
- Create: `src/features/tasks/components/available-jobs-section.tsx`
- Create: `src/features/tasks/components/not-available-section.tsx`
- Create: `src/features/tasks/components/task-detail-sheet.tsx`
- Modify: `src/features/tasks/components/my-work-page.tsx` (replace stub)
- Modify: `src/features/tasks/components/jobs-page.tsx` (replace stub)
- Modify: `src/features/attendance/components/mobile-attendance-summary.tsx` (rewrite as status strip)
- Modify: `src/features/attendance/components/staff-mobile-dashboard.tsx` (new composition)
- Create: `src/features/attendance/components/performance-snapshot.tsx`
- Delete: `src/features/attendance/components/in-progress-tasks.tsx`, `src/features/attendance/components/task-groups.tsx`

**Interfaces:**
- Consumes: `tasksKeys`, query options, `useTakeTask`, `useCompleteTask` from Task 3; `myAttendanceQueryOptions`, `performanceStatsQueryOptions` from attendance queries.
- Produces: `TaskCard` (props `{ task, action?: ReactNode }`), `MyWorkSection`, `AvailableJobsSection`, `NotAvailableSection`, `TaskDetailSheet` (props `{ task, open, onOpenChange }`), `MyWorkPage`, `JobsPage`, `PerformanceSnapshot`.

- [ ] **Step 1: Create `src/features/tasks/components/task-card.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { Task, TaskPriority, TaskStatus } from '../api/types';

const priorityBadge: Record<TaskPriority, 'outline' | 'secondary' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'destructive'
};

const statusBadge: Partial<Record<TaskStatus, 'outline' | 'secondary' | 'default'>> = {
  assigned: 'outline',
  in_progress: 'default',
  available: 'secondary'
};

export function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No deadline';
  const date = new Date(dueAt);
  return `Due ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

export default function TaskCard({ task, action }: { task: Task; action?: ReactNode }) {
  return (
    <Card className='rounded-xl p-3.5'>
      <div className='mb-1.5 flex items-center gap-1.5'>
        <span className='text-muted-foreground text-[10px] font-medium uppercase'>
          {task.task_type}
        </span>
        <Badge variant={priorityBadge[task.priority]} className='h-4 rounded-full px-1.5 text-[9px]'>
          {task.priority}
        </Badge>
        {task.status !== 'available' && (
          <Badge variant={statusBadge[task.status]} className='h-4 rounded-full px-1.5 text-[9px]'>
            {task.status.replace('_', ' ')}
          </Badge>
        )}
      </div>
      <p className='mb-1 text-sm font-semibold leading-tight'>{task.title}</p>
      <div className='text-muted-foreground space-y-0.5 text-[11px]'>
        {task.location && (
          <p className='flex items-center gap-1'>
            <Icons.workspace className='h-3 w-3 shrink-0' />
            {task.location.name}
          </p>
        )}
        <p className='flex items-center gap-1'>
          <Icons.clock className='h-3 w-3 shrink-0' />
          {formatDue(task.dueAt)}
          {task.estimatedMinutes != null && ` · ${task.estimatedMinutes} min`}
        </p>
      </div>
      {task.requiredSkills.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-1'>
          {task.requiredSkills.map((s) => (
            <span key={s} className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]'>
              {s}
            </span>
          ))}
        </div>
      )}
      {action && <div className='mt-3'>{action}</div>}
    </Card>
  );
}
```

- [ ] **Step 2: Create `src/features/tasks/components/task-detail-sheet.tsx`**

```tsx
import { Link } from '@tanstack/react-router';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import TaskCard, { formatDue } from './task-card';
import { useTakeTask, useCompleteTask } from '../api/hooks';
import type { Task } from '../api/types';

export default function TaskDetailSheet({
  task,
  open,
  onOpenChange
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const takeTask = useTakeTask();
  const completeTask = useCompleteTask();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='bottom' className='rounded-t-2xl'>
        {task && (
          <>
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription>
                {task.task_type} · {formatDue(task.dueAt)}
              </SheetDescription>
            </SheetHeader>
            <div className='space-y-4 pt-4'>
              {task.description && (
                <p className='text-muted-foreground text-sm'>{task.description}</p>
              )}
              <div className='text-muted-foreground space-y-1.5 text-sm'>
                {task.location && (
                  <p className='flex items-center gap-2'>
                    <Icons.workspace className='h-4 w-4' /> {task.location.name}
                  </p>
                )}
                <p className='flex items-center gap-2'>
                  <Icons.clock className='h-4 w-4' /> {formatDue(task.dueAt)}
                  {task.estimatedMinutes != null && ` · ${task.estimatedMinutes} min`}
                </p>
              </div>
              {task.requiredSkills.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {task.requiredSkills.map((s) => (
                    <Badge key={s} variant='outline' className='rounded-full'>
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              {task.status === 'available' && (
                <Button
                  className='w-full'
                  onClick={() => takeTask.mutate(task.id)}
                  disabled={takeTask.isPending}
                >
                  {takeTask.isPending ? (
                    <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.check className='mr-2 h-4 w-4' />
                  )}
                  Take Task
                </Button>
              )}
              {task.status === 'in_progress' && (
                <Button
                  className='w-full'
                  variant='secondary'
                  onClick={() => completeTask.mutate(task.id)}
                  disabled={completeTask.isPending}
                >
                  {completeTask.isPending ? (
                    <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.check className='mr-2 h-4 w-4' />
                  )}
                  Mark Complete
                </Button>
              )}
              {task.status === 'assigned' && (
                <Link to='/dashboard/my-work' className='block'>
                  <Button variant='outline' className='w-full'>
                    Open My Work
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

Note: `TaskCard` is imported above for reuse in lists; the detail sheet renders its own layout. If `SheetContent` needs `overscroll-behavior: contain`, it is already handled by the shadcn sheet component — verify at runtime.

- [ ] **Step 3: Create `src/features/tasks/components/my-work-section.tsx`**

```tsx
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { myTasksQueryOptions } from '../api/queries';
import TaskCard from './task-card';
import TaskDetailSheet from './task-detail-sheet';

export default function MyWorkSection() {
  const { data } = useQuery(myTasksQueryOptions());
  const tasks = data?.tasks ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className='px-4'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>My Work</h2>
        <Link to='/dashboard/my-work' className='text-primary text-xs font-medium'>
          See all
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className='text-muted-foreground py-2 text-sm'>No assigned tasks</p>
      ) : (
        <div className='space-y-2.5'>
          {tasks.slice(0, 3).map((task) => (
            <div key={task.id}>
              <TaskCard
                task={task}
                action={
                  <Button
                    size='sm'
                    variant='outline'
                    className='w-full'
                    onClick={() => setSelectedId(task.id)}
                  >
                    Open
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      )}
      <TaskDetailSheet
        task={selected}
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create `src/features/tasks/components/available-jobs-section.tsx`**

```tsx
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useTakeTask } from '../api/hooks';
import { availableTasksQueryOptions } from '../api/queries';
import TaskCard from './task-card';
import NotAvailableSection from './not-available-section';

export default function AvailableJobsSection() {
  const { data } = useQuery(availableTasksQueryOptions());
  const tasks = data?.tasks ?? [];
  const takeTask = useTakeTask();

  return (
    <div className='px-4'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>Available Jobs</h2>
        <Link to='/dashboard/jobs' className='text-primary text-xs font-medium'>
          See all
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className='text-muted-foreground py-2 text-sm'>
          No jobs available right now — check back later
        </p>
      ) : (
        <ScrollArea className='w-full pb-2'>
          <div className='flex gap-3'>
            {tasks.map((task) => (
              <div key={task.id} className='w-64 shrink-0'>
                <TaskCard
                  task={task}
                  action={
                    <Button
                      size='sm'
                      className='w-full'
                      onClick={() => takeTask.mutate(task.id)}
                      disabled={takeTask.isPending}
                    >
                      {takeTask.isPending ? 'Taking…' : 'Take'}
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation='horizontal' className='invisible' />
        </ScrollArea>
      )}
      <NotAvailableSection />
    </div>
  );
}
```

Note: "Taking…" uses the Unicode ellipsis per the writing guidelines.

- [ ] **Step 5: Create `src/features/tasks/components/not-available-section.tsx`**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icons } from '@/components/icons';
import { availableTasksQueryOptions } from '../api/queries';

export default function NotAvailableSection() {
  const { data } = useQuery(availableTasksQueryOptions());
  const unavailable = data?.unavailable ?? [];
  const [open, setOpen] = useState(false);

  if (unavailable.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className='mt-3'>
      <CollapsibleTrigger className='text-muted-foreground flex items-center gap-1 text-xs'>
        <Icons.chevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        Not available for you ({unavailable.length})
      </CollapsibleTrigger>
      <CollapsibleContent className='mt-2 space-y-1.5'>
        {unavailable.slice(0, 3).map((task) => (
          <div key={task.id} className='bg-muted/50 rounded-lg px-3 py-2'>
            <p className='text-xs font-medium'>{task.title}</p>
            <p className='text-muted-foreground text-[11px]'>
              {task.eligibilityReasons.join(' · ')}
            </p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

Note: this section deliberately has no action button of any kind.

- [ ] **Step 6: Replace the `my-work-page.tsx` stub**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { myTasksQueryOptions } from '../api/queries';
import TaskCard from './task-card';
import TaskDetailSheet from './task-detail-sheet';

export default function MyWorkPage() {
  const { data, isLoading } = useQuery(myTasksQueryOptions());
  const tasks = data?.tasks ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const assigned = tasks.filter((t) => t.status === 'assigned');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');

  return (
    <div className='space-y-6 p-4'>
      <div>
        <h2 className='mb-3 text-sm font-semibold'>In Progress ({inProgress.length})</h2>
        {inProgress.length === 0 ? (
          <p className='text-muted-foreground text-sm'>Nothing in progress</p>
        ) : (
          <div className='space-y-2.5'>
            {inProgress.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                action={
                  <Button
                    size='sm'
                    variant='outline'
                    className='w-full'
                    onClick={() => setSelectedId(task.id)}
                  >
                    Open
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className='mb-3 text-sm font-semibold'>Assigned ({assigned.length})</h2>
        {assigned.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No assigned tasks</p>
        ) : (
          <div className='space-y-2.5'>
            {assigned.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                action={
                  <Button
                    size='sm'
                    variant='outline'
                    className='w-full'
                    onClick={() => setSelectedId(task.id)}
                  >
                    Open
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>
      <TaskDetailSheet
        task={selected}
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 7: Replace the `jobs-page.tsx` stub**

```tsx
import { useSearch, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as JobsRoute } from '@/routes/dashboard/jobs/index';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useTakeTask } from '../api/hooks';
import { availableTasksQueryOptions } from '../api/queries';
import { locationsQueryOptions } from '@/features/attendance/api/queries';
import TaskCard from './task-card';
import type { TaskPriority } from '../api/types';

export default function JobsPage() {
  const { locationId, priority } = useSearch({ from: JobsRoute.id });
  const navigate = useNavigate();
  const filters = {
    ...(locationId ? { locationId } : {}),
    ...(priority ? { priority: priority as TaskPriority } : {})
  };
  const { data, isLoading } = useQuery(availableTasksQueryOptions(filters));
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const tasks = data?.tasks ?? [];
  const takeTask = useTakeTask();

  function setFilters(next: { locationId?: number; priority?: string }) {
    navigate({ to: '/dashboard/jobs', search: next });
  }

  return (
    <div className='space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>Available Jobs ({tasks.length})</h2>
        <button
          onClick={() => setFilters({})}
          className='text-muted-foreground text-xs'
        >
          Clear filters
        </button>
      </div>
      <div className='flex gap-2'>
        <Select
          value={locationId ? String(locationId) : 'all'}
          onValueChange={(v) => setFilters({ ...(v === 'all' ? {} : { locationId: Number(v) }), ...(priority ? { priority } : {}) })}
        >
          <SelectTrigger className='w-32'>
            <SelectValue placeholder='Location' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All locations</SelectItem>
            {locationsData?.locations.map((loc) => (
              <SelectItem key={loc.id} value={String(loc.id)}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priority ?? 'all'}
          onValueChange={(v) => setFilters({ ...(locationId ? { locationId } : {}), ...(v === 'all' ? {} : { priority: v }) })}
        >
          <SelectTrigger className='w-28'>
            <SelectValue placeholder='Priority' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All priorities</SelectItem>
            <SelectItem value='low'>Low</SelectItem>
            <SelectItem value='medium'>Medium</SelectItem>
            <SelectItem value='high'>High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className='flex justify-center py-8'>
          <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : tasks.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          No jobs available right now — check back later
        </p>
      ) : (
        <div className='space-y-2.5'>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              action={
                <Button
                  size='sm'
                  className='w-full'
                  onClick={() => takeTask.mutate(task.id)}
                  disabled={takeTask.isPending}
                >
                  {takeTask.isPending ? 'Taking…' : 'Take Task'}
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Rewrite `mobile-attendance-summary.tsx` as a status strip**

Replace the entire file:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { myAttendanceQueryOptions } from '../api/queries';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  present: 'default',
  late: 'secondary',
  absent: 'destructive',
  excused: 'outline',
  pending: 'outline'
};

export default function MobileAttendanceSummary() {
  const { data: todayData } = useQuery(myAttendanceQueryOptions());

  const attendance = todayData?.attendance;
  const record = attendance?.attendance;
  const isCheckedIn = !!record?.check_in_time;
  const isCheckedOut = !!record?.check_out_time;
  const status = record?.attendance_status ?? 'pending';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className='px-4'>
      <Link to='/dashboard/attendance' className='block'>
        <Card className='flex items-center gap-3 rounded-2xl p-4'>
          <div className='bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'>
            <Icons.clock className='text-primary h-5 w-5' />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-muted-foreground text-[11px]'>{today}</p>
            <p className='truncate text-sm font-semibold'>
              {isCheckedOut
                ? `Checked out at ${record!.check_out_time}`
                : isCheckedIn
                  ? `Checked in at ${record!.check_in_time}`
                  : 'Not yet checked in'}
            </p>
          </div>
          <Badge variant={statusVariant[status] ?? 'outline'} className='h-5 rounded-full px-2 text-[10px]'>
            {status}
          </Badge>
          <Icons.chevronRight className='text-muted-foreground h-4 w-4 shrink-0' />
        </Card>
      </Link>
    </div>
  );
}
```

- [ ] **Step 9: Create `performance-snapshot.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { performanceStatsQueryOptions } from '../api/queries';

export default function PerformanceSnapshot() {
  const { data } = useQuery(performanceStatsQueryOptions());
  const reports = data?.reports ?? [];
  if (reports.length === 0) return null;

  const latest = reports[reports.length - 1];
  return (
    <div className='px-4'>
      <Card className='rounded-2xl p-4'>
        <p className='text-muted-foreground text-[11px] font-medium uppercase'>Your performance</p>
        <p className='mt-1 text-lg font-semibold tabular-nums'>{latest.score ?? '—'}%</p>
        <p className='text-muted-foreground text-xs'>{latest.date}</p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 10: Rewrite `staff-mobile-dashboard.tsx`**

```tsx
import MobileAttendanceSummary from './mobile-attendance-summary';
import MyWorkSection from '@/features/tasks/components/my-work-section';
import AvailableJobsSection from '@/features/tasks/components/available-jobs-section';
import PerformanceSnapshot from './performance-snapshot';

export default function StaffMobileDashboard() {
  return (
    <div className='mt-2 space-y-6'>
      <MobileAttendanceSummary />
      <MyWorkSection />
      <AvailableJobsSection />
      <PerformanceSnapshot />
    </div>
  );
}
```

- [ ] **Step 11: Delete dead components**

```bash
git rm src/features/attendance/components/in-progress-tasks.tsx src/features/attendance/components/task-groups.tsx
```

Verify no remaining imports: `grep -rn "in-progress-tasks\|task-groups" src/ || true` → no output.

- [ ] **Step 12: Verify**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add src/features/tasks src/features/attendance/components/mobile-attendance-summary.tsx src/features/attendance/components/staff-mobile-dashboard.tsx src/features/attendance/components/performance-snapshot.tsx
git commit -m "feat: build work-first mobile dashboard with job pool"
```

---

### Task 8: Profile Screen

**Files:**
- Modify: `src/features/profile/components/profile-page.tsx` (replace stub)

**Interfaces:**
- Consumes: `useSession`/`signOut` from `@/lib/auth/auth-client`, `attendanceSummaryQueryOptions`, `myTasksQueryOptions`, `Icons`, `Avatar`, `Badge`, `Card`.

- [ ] **Step 1: Replace the profile stub**

```tsx
import { useRouter } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useSession, signOut } from '@/lib/auth/auth-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { attendanceSummaryQueryOptions } from '@/features/attendance/api/queries';
import { myTasksQueryOptions } from '@/features/tasks/api/queries';

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: summaryData } = useQuery(attendanceSummaryQueryOptions());
  const { data: tasksData } = useQuery(myTasksQueryOptions());

  const user = session?.user;
  const name = user?.name ?? 'User';
  const email = user?.email ?? '';
  const role = user?.role ?? 'user';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const summary = summaryData?.summary;
  const tasks = tasksData?.tasks ?? [];
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;

  async function handleLogout() {
    await signOut();
    router.navigate({ to: '/' });
  }

  return (
    <div className='space-y-5 p-4'>
      <div className='flex flex-col items-center gap-2 pt-4'>
        <Avatar className='border h-20 w-20'>
          <AvatarFallback className='bg-primary/10 text-primary text-xl font-semibold'>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className='text-center'>
          <p className='text-base font-semibold'>{name}</p>
          <p className='text-muted-foreground text-xs'>{email}</p>
        </div>
        <Badge variant='secondary' className='rounded-full capitalize'>
          {role}
        </Badge>
      </div>

      <Card className='rounded-2xl p-4'>
        <p className='text-muted-foreground mb-2 text-[11px] font-medium uppercase'>This month</p>
        <div className='flex justify-around text-center'>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{summary?.present ?? '—'}</p>
            <p className='text-muted-foreground text-[11px]'>Present</p>
          </div>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{summary?.late ?? '—'}</p>
            <p className='text-muted-foreground text-[11px]'>Late</p>
          </div>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{summary?.absent ?? '—'}</p>
            <p className='text-muted-foreground text-[11px]'>Absent</p>
          </div>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{inProgress}</p>
            <p className='text-muted-foreground text-[11px]'>Active tasks</p>
          </div>
        </div>
      </Card>

      <Card className='rounded-2xl'>
        <Link to='/dashboard/notifications' className='hover:bg-muted flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm'>
          <Icons.notification className='text-muted-foreground h-4 w-4' />
          Notifications
          <Icons.chevronRight className='text-muted-foreground ml-auto h-4 w-4' />
        </Link>
        <hr />
        <button
          onClick={handleLogout}
          className='hover:bg-muted flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm'
        >
          <Icons.logout className='text-muted-foreground h-4 w-4' />
          Sign out
          <Icons.chevronRight className='text-muted-foreground ml-auto h-4 w-4' />
        </button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run typecheck && bun run lint`
Expected: no errors. (If `summary?.present` shows `0` instead of `—` when present, that is correct — `0` is a real value.)

- [ ] **Step 3: Commit**

```bash
git add src/features/profile/components/profile-page.tsx
git commit -m "feat: add mobile profile screen"
```

---

### Task 9: Mobile Attendance & Leave Screens

**Files:**
- Modify: `src/features/attendance/components/attendance-history.tsx` (mobile card list)
- Modify: `src/features/attendance/components/leave-history.tsx` (segmented filter + mobile cards)
- Create: `src/features/attendance/components/leave-request-fields.tsx`
- Modify: `src/features/attendance/components/leave-request-form.tsx` (use shared fields; desktop only)
- Create: `src/features/attendance/components/mobile-leave-request-sheet.tsx`
- Modify: `src/features/attendance/components/leave-page.tsx`

**Interfaces:**
- Consumes: existing queries (`attendanceHistoryQueryOptions`, `myLeavesQueryOptions`), `Sheet` from `@/components/ui/sheet`, `Card`, `Badge`, `Button`, `Icons`.
- Produces: `LeaveRequestFields` (self-contained form: leave type, dates, reason, submit with toast + invalidation), `MobileLeaveRequestSheet` (trigger button + Sheet).

- [ ] **Step 1: Update `attendance-history.tsx` — add duration helper and mobile card list**

Add a helper at the top of the file (after imports):

```tsx
function formatDuration(inTime?: string | null, outTime?: string | null): string | null {
  if (!inTime || !outTime) return null;
  const [ih, im] = inTime.split(':').map(Number);
  const [oh, om] = outTime.split(':').map(Number);
  const mins = oh * 60 + om - (ih * 60 + im);
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const historyStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  present: 'default',
  late: 'secondary',
  absent: 'destructive',
  excused: 'outline',
  pending: 'outline'
};
```

Wrap the existing `<Table>…</Table>` block in `<div className='hidden md:block'>` … `</div>`, then add below it (inside the same conditional branch that renders records, after the table div):

```tsx
<div className='space-y-2 md:hidden'>
  {records.map(({ attendance, shift }) => (
    <Card key={attendance.id} className='flex items-center gap-3 rounded-xl p-3.5'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold'>{attendance.date}</p>
        <p className='text-muted-foreground truncate text-[11px]'>
          {shift ? shift.name : 'No shift'} ·{' '}
          {formatDuration(attendance.check_in_time, attendance.check_out_time) ?? '—'}
        </p>
        <p className='text-muted-foreground text-[11px]'>
          {attendance.check_in_time ?? '--:--'} – {attendance.check_out_time ?? '--:--'}
        </p>
      </div>
      <Badge
        variant={historyStatusVariant[attendance.attendance_status ?? 'pending'] ?? 'outline'}
        className='h-5 rounded-full px-2 text-[10px]'
      >
        {attendance.attendance_status ?? 'pending'}
      </Badge>
    </Card>
  ))}
</div>
```

- [ ] **Step 2: Update `leave-history.tsx` — segmented filter + mobile cards**

Add a status filter row for mobile (before the existing Select row), and wrap the existing Select row in `hidden md:flex`:

```tsx
const statusFilters = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
] as const;
```

Replace the `<div className='flex gap-2'>` Select wrapper with:

```tsx
<div className='flex gap-2 md:hidden'>
  {statusFilters.map((f) => (
    <button
      key={f.value}
      onClick={() => setStatusFilter(f.value)}
      className={`h-9 rounded-full px-3 text-xs font-medium ${
        (statusFilter || '') === f.value
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {f.label}
    </button>
  ))}
</div>
<div className='hidden gap-2 md:flex'>
  ... existing Select ...
</div>
```

Wrap the existing `<Table>…</Table>` in `<div className='hidden md:block'>`, then add mobile cards after it (inside the records branch):

```tsx
<div className='space-y-2 md:hidden'>
  {leaves.map((leave) => (
    <Card key={leave.id} className='rounded-xl p-3.5'>
      <div className='flex items-center justify-between gap-2'>
        <p className='min-w-0 flex-1 truncate text-sm font-semibold capitalize'>
          {leave.leave_type} leave
        </p>
        <Badge variant={statusColors[leave.status ?? 'cancelled'] ?? 'outline'} className='h-5 rounded-full px-2 text-[10px]'>
          {leave.status}
        </Badge>
      </div>
      <p className='text-muted-foreground mt-1 text-[11px]'>
        {leave.start_date} – {leave.end_date} · {leave.total_days} day{leave.total_days !== 1 ? 's' : ''}
      </p>
      {leave.reason && <p className='text-muted-foreground mt-0.5 truncate text-[11px]'>{leave.reason}</p>}
    </Card>
  ))}
</div>
```

- [ ] **Step 3: Extract `leave-request-fields.tsx`**

Move the form fields + submit logic from `leave-request-form.tsx` into a self-contained component (keep the exact same validation, mutation, toast, and invalidation logic):

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { createLeaveRequestFn } from '../api/service';
import type { LeaveType } from '../api/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const leaveTypes: { value: LeaveType; label: string }[] = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' }
] as const;

export default function LeaveRequestFields() {
  const queryClient = useQueryClient();
  const [leaveType, setLeaveType] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createLeaveRequestFn({
        data: {
          leaveType: leaveType as LeaveType,
          startDate,
          endDate,
          reason: reason || undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success('Leave request submitted');
        setLeaveType('');
        setStartDate('');
        setEndDate('');
        setReason('');
        queryClient.invalidateQueries({ queryKey: ['attendance', 'leaves'] });
      } else {
        toast.error(res?.message ?? 'Failed to submit leave request');
      }
    },
    onError: () => {
      toast.error('Failed to submit leave request');
    }
  });

  const canSubmit = leaveType && startDate && endDate && startDate <= endDate && !mutation.isPending;
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>Leave Type</Label>
        <Select value={leaveType} onValueChange={(v: string) => setLeaveType(v)}>
          <SelectTrigger>
            <SelectValue placeholder='Select leave type' />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label>Start Date</Label>
          <Input type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} min={today} />
        </div>
        <div className='space-y-2'>
          <Label>End Date</Label>
          <Input type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || today} />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Reason</Label>
        <Textarea
          placeholder='Optional reason for leave'
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>

      <Button className='w-full' onClick={() => mutation.mutate()} disabled={!canSubmit}>
        {mutation.isPending ? (
          <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
        ) : (
          <Icons.send className='mr-2 h-4 w-4' />
        )}
        Submit Leave Request
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Slim down `leave-request-form.tsx` to the desktop card**

Replace the file body so it renders the card header + shared fields, hidden on mobile:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import LeaveRequestFields from './leave-request-fields';

export default function LeaveRequestForm() {
  return (
    <div className='hidden md:block'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.calendar className='h-5 w-5' />
            New Leave Request
          </CardTitle>
          <CardDescription>Submit a leave request for approval</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveRequestFields />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Create `mobile-leave-request-sheet.tsx`**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import LeaveRequestFields from './leave-request-fields';

export default function MobileLeaveRequestSheet() {
  return (
    <div className='md:hidden'>
      <Sheet>
        <SheetTrigger asChild>
          <Button className='w-full gap-2'>
            <Icons.plus className='h-4 w-4' />
            Request Leave
          </Button>
        </SheetTrigger>
        <SheetContent side='bottom' className='rounded-t-2xl'>
          <SheetHeader>
            <SheetTitle>New Leave Request</SheetTitle>
            <SheetDescription>Submit a leave request for approval</SheetDescription>
          </SheetHeader>
          <div className='pt-4'>
            <LeaveRequestFields />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

Note: check `src/components/ui/sheet.tsx` exports `SheetTrigger` (standard shadcn — it does). If `Icons.plus` is missing from `src/components/icons.tsx`, use `Icons.calendar` instead.

- [ ] **Step 6: Update `leave-page.tsx`**

```tsx
import LeaveRequestForm from './leave-request-form';
import MobileLeaveRequestSheet from './mobile-leave-request-sheet';
import LeaveHistory from './leave-history';

export default function LeavePage() {
  return (
    <div className='space-y-6'>
      <LeaveRequestForm />
      <MobileLeaveRequestSheet />
      <LeaveHistory />
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `bun run typecheck && bun run lint`
Expected: no errors. Fix any icon-name mismatches by checking `src/components/icons.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/features/attendance/components/attendance-history.tsx src/features/attendance/components/leave-history.tsx src/features/attendance/components/leave-request-fields.tsx src/features/attendance/components/leave-request-form.tsx src/features/attendance/components/mobile-leave-request-sheet.tsx src/features/attendance/components/leave-page.tsx
git commit -m "feat: make attendance and leave screens mobile-native"
```

---

### Task 10: Docs Update

**Files:**
- Modify: `docs/MOBILE.md`
- Modify: `docs/PRD.md`
- Modify: `docs/CHANGELOG.md` (append under the existing `[Unreleased — 2026-07-31]` section)

- [ ] **Step 1: Update `docs/MOBILE.md`**

- Navigation table: replace 4-item list with 5 tabs (`Home`, `My Work`, `Attendance`, `Leave`, `Profile`) and the new routes.
- FAB section: describe it as a shortcut `Link` to `/dashboard/attendance` (no mutation).
- Home sections: `MobileAttendanceSummary` (status strip), `MyWorkSection`, `AvailableJobsSection` (+ `NotAvailableSection`), `PerformanceSnapshot`.
- Component table: add tasks components (`TaskCard`, `TaskDetailSheet`, `MyWorkPage`, `JobsPage`), remove `InProgressTasks`/`TaskGroups` rows.

- [ ] **Step 2: Update `docs/PRD.md`**

Under **Implemented Features**, append a bullet:

```markdown
- **Mobile Work Dashboard** — Driver-style home for staff: assigned tasks first, eligibility-gated available-jobs pool (department/designation/location/skill), transactional task claiming, attendance status strip, 5-tab bottom nav, profile screen
```

Under **Roadmap → Now**, append checked items:

```markdown
- [x] Tasks schema (tasks, task_requirements, employee_skills) with server-enforced eligibility
- [x] Driver-style mobile home (My Work + Available Jobs) with FAB attendance shortcut
- [x] Profile screen replacing the misleading Profile→notifications tab
```

- [ ] **Step 3: Update `docs/CHANGELOG.md`**

Append under the `[Unreleased — 2026-07-31]` section (after the Audit bullets):

```markdown
### Mobile Work Dashboard

- **Driver-style home** — Assigned-first My Work + eligibility-gated Available Jobs pool (department, designation, location, skill); transactional `takeTask` claim with capacity limit; ineligible tasks listed without actions
- **Navigation** — Bottom nav now Home | My Work | Attendance | Leave | Profile; FAB is an attendance shortcut (no implicit check-in)
- **Mobile screens** — Attendance/leave history as card lists on mobile (tables on desktop); leave request via bottom sheet; profile screen with month summary
```

- [ ] **Step 4: Verify**

Run: `bun run lint && bun run typecheck && bun run test:run && bun run build`
Expected: all pass (full gate before finishing).

- [ ] **Step 5: Commit**

```bash
git add docs/MOBILE.md docs/PRD.md docs/CHANGELOG.md
git commit -m "docs: document mobile work dashboard"
```

---

## Final Verification

Run the full gate:

```bash
bun run lint && bun run typecheck && bun run test:run && bun run build
```

Then smoke-test manually against the spec acceptance criteria:

1. Log in as `technician@example.com` on a mobile viewport → home shows attendance strip, My Work (1 assigned task), Available Jobs (only Fiber Optic/Networking tasks), performance card absent (no reports).
2. Log in as `employee@example.com` → Available Jobs shows only the sales task; technician pool tasks listed under "Not available for you" with reasons.
3. `Take` on a pool task → moves to My Work → In Progress; second user cannot take the same task; FAB navigates to attendance without checking in.
4. Bottom nav: all five tabs navigate; Profile shows user info + month summary; Leave screen opens the bottom sheet form on mobile.

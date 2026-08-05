# Mobile Work Dashboard Design (Employee / Technician)

Date: 2026-07-31
Status: Approved by user (conceptual approval; pending spec review)

## Problem

The current mobile experience for `employee` / `technician` roles is an
attendance-first dashboard:

- `MobileAttendanceSummary` (attendance ring + check-in/out button) is the
  hero content of the home screen.
- `InProgressTasks` mixes leave requests with check-in state, which is
  confusing — leave requests are not operational tasks.
- `TaskGroups` renders all departments with a hardcoded 70% progress.
- The bottom nav "Profile" tab routes to `/dashboard/notifications`, which
  is misleading; there is no real profile screen.
- Attendance and leave screens render desktop `<Table>` components on
  mobile widths.

The user wants a **driver-style dashboard** (Gojek/Grab/Meituan pattern)
that **encourages taking and completing work**, with attendance demoted to
supporting status.

## Goals

- Home screen structured to drive task pickup: **Assigned-first, then
  Available Jobs pool**.
- Hybrid task model: tasks are either assigned by a supervisor or taken
  from a shared pool.
- Eligibility-gated job pool: a user only sees/takes tasks matching their
  `department`, `designation`, `location`, and `skill`.
- Attendance reduced to a status strip + shortcut; FAB navigates to
  attendance (it no longer performs check-in/check-out).
- Real bottom navigation: `Home | My Work | Attendance | Leave | Profile`.
- Mobile-native attendance/leave screens (card lists instead of tables;
  leave request as a bottom sheet).
- Same layout for employee and technician — differences come from
  eligibility, not from separate dashboards.

## Non-Goals (explicitly deferred)

- **Leave balance** — no API/data source exists yet; add later when the
  backend supports it.
- **Performance score logic** — the formula (task completion, attendance,
  on-time, rework) is not finalized; must never be hardcoded UI numbers.
- **Technician-specific workflows beyond eligibility** — a dedicated
  "Assigned Tasks" phase is future work; eligibility covers the difference.
- **Offline mode** — out of scope; requires its own design.
- **Notification redesign** — only nav linkage changes.

## Information Architecture

Bottom navigation (5 items):

| Tab | Route | Notes |
|-----|-------|-------|
| Home | `/dashboard/overview` | Driver-style dashboard (below) |
| My Work | `/dashboard/my-work` | Assigned + taken tasks, task detail |
| Attendance | `/dashboard/attendance` | Existing route |
| Leave | `/dashboard/leave` | Existing route |
| Profile | `/dashboard/profile` | New route — real profile screen |

The FAB on the bottom nav becomes a **navigation shortcut** to
`/dashboard/attendance`. It must not perform check-in/check-out and must
not be an eligibility or task action.

Navigation must use `<Link>` (TanStack Router `Link`) instead of
`button + router.navigate` for all nav items, preserving
middle-click/command-click and keyboard navigation. Icon-only buttons
(notification bell, back, avatar menu trigger) need `aria-label`.

## Home Screen (Driver-Style Dashboard)

Section order (top to bottom):

1. **Header** — avatar + greeting + name, role/designation subtitle,
   notification bell with unread badge. Existing `MobileHeader` behavior,
   with role/designation added.
2. **Attendance status strip** — compact card: checked-in state + time,
   or "Not checked in", plus a `View Attendance` affordance. Reuses
   `myAttendanceQueryOptions()` data. No check-in/out action here.
3. **My Work** — vertical list of assigned + in-progress tasks, up to N
   (e.g. 3), then `See all →` to `/dashboard/my-work`. Each card:
   title, task type, priority badge, due date, location, `Open` action.
4. **Available Jobs** — horizontal scroll of eligible pool tasks (card
   width ≈ 280px). Each card: title, type, location, due/schedule,
   required skills, estimated duration, `Take` button. `See all →`
   to `/dashboard/jobs` (full list, filterable).
5. **Not available for you** — optional collapsed section listing tasks
   that failed eligibility, each showing the *reason* (e.g. "Requires
   Network Technician", "Outside your assigned location"). No `Take`
   button anywhere in this section. Collapsed by default; can be omitted
   in the first iteration if no requirements support exists.
6. **Performance snapshot** — placeholder card rendered only when the
   backend performance API returns data. No hardcoded percentages. If no
   data: render nothing (not "0%").

Empty states required for every list: "No assigned tasks", "No jobs
available right now — check back later", "Not checked in yet".

## Task Domain Model

New Drizzle schema `src/lib/db/schema/tasks.ts`:

```sql
tasks (
  id: serial PK,
  title: text NOT NULL,
  description: text NOT NULL DEFAULT '',
  task_type: text NOT NULL DEFAULT 'general',   -- future: distinct types
  status: text NOT NULL DEFAULT 'available',    -- see statuses below
  priority: text NOT NULL DEFAULT 'medium',     -- low | medium | high
  location_id: integer?,                        -- FK locations.id, nullable
  due_at: timestamp?,                           -- nullable (no deadline)
  estimated_minutes: integer?,
  assigned_to: text?,                           -- FK user.id, for 'assigned'
  taken_by: text?,                              -- FK user.id, for 'in_progress'
  taken_at: timestamp?,
  completed_at: timestamp?,
  created_by: text NOT NULL,                    -- FK user.id (admin/hr)
  created_at, updated_at
)

task_requirements (
  id: serial PK,
  task_id: integer NOT NULL FK tasks.id,
  department_id: integer?,   -- nullable requirement
  designation_id: integer?,  -- nullable requirement
  location_id: integer?,     -- nullable requirement
  skill: text?               -- nullable; one row per required skill
)

-- task_requirements rows are AND-ed: a user must satisfy every
-- non-null requirement for the task to be eligible.
```

Task statuses (state machine):

```
assigned ──→ in_progress ──→ completed
available ─→ in_progress ──→ completed
any active ────────────────→ cancelled
```

- `assigned` — supervisor-given, `assigned_to` set, not started.
- `available` — pool task, no owner.
- `in_progress` — claimed via `takeTask`, `taken_by` + `taken_at` set.
- `completed` — finished via `completeTask`, `completed_at` set.
- `cancelled` — removed from rotation.

## Eligibility Rules

A task is eligible for a user iff:

1. User's `employees.status = 'active'` (and auth user not banned).
2. Every non-null `task_requirements` row matches:
   - `department_id` → user's `employees.department_id`
   - `designation_id` → user's `employees.designation_id`
   - `location_id` → user's `employees.location_id`
   - `skill` → user must possess the skill (employee skills table; see
     note below)

Schema prerequisite: `employees` has `department_id` and `designation_id`
but **no location column** (`src/lib/db/schema/masterdata.ts:35-58`).
Add `location_id: integer?` FK → `locations.id` (nullable) to `employees`
as part of this work; eligibility checks it only when set. Seed demo
employees with their branch locations.
3. Capacity: user has fewer than `MAX_ACTIVE_TASKS` (default 3, config
   constant) tasks in `assigned`/`in_progress` status.

**Two-layer enforcement:**

- **Server (source of truth)** — `takeTask(taskId)` re-validates all
  eligibility inside the server function (following the existing
  `requireSession` + Zod-validated pattern in
  `src/lib/db/attendance.ts` / attendance service), and claims the task
  with a transaction that re-checks `status = 'available'` before the
  update so two users cannot claim the same task.
- **Client (UX only)** — the available-jobs query returns only eligible
  tasks (server-filtered), so the client never renders ineligible tasks
  in the main feed. Client-side logic must never be treated as
  authorization.

**Employee skills:** if no skill field exists on `employees`, add
`employee_skills (id, user_id FK, skill text, unique(user_id, skill))`.
Minimal viable version: seed from designation name as a single skill per
user.

## Task API (feature: `src/features/tasks/`)

Follow the existing attendance feature pattern (`api/types.ts`,
`api/queries.ts`, `api/service.ts`).

Types:

```ts
type TaskStatus = 'assigned' | 'available' | 'in_progress' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high';

type Task = {
  id: number;
  title: string;
  description: string;
  task_type: string;
  status: TaskStatus;
  priority: TaskPriority;
  location?: { id: number; name: string } | null;
  dueAt?: string | null;
  estimatedMinutes?: number | null;
  requiredSkills: string[];
  assignedTo?: string | null;
  takenBy?: string | null;
};

type AvailableTask = Task & {
  eligibilityReasons: string[]; // explanations when ineligible (for "Not available for you")
};

type TakeTaskResponse = { success: boolean; message?: string; task?: Task };
type CompleteTaskResponse = { success: boolean; message?: string; task?: Task };
```

Server functions (all `requireSession()`, Zod-validated):

- `getMyTasksFn()` → tasks where `assigned_to = me` or `taken_by = me`
  and status in `assigned | in_progress`.
- `getAvailableTasksFn({ filters })` → pool tasks (`available` status)
  that pass eligibility, plus (optional flag) ineligible ones with
  `eligibilityReasons` for the "Not available" section.
- `takeTaskFn({ taskId })` → claims a pool task; re-validates
  eligibility + status + capacity; transactional claim.
- `completeTaskFn({ taskId })` → closes an `in_progress` task owned by
  the caller.

Query options:

- `myTasksQueryOptions()`
- `availableTasksQueryOptions(filters)`
- `taskDetailQueryOptions(taskId)`
- `takeTaskFn`, `completeTaskFn` mutations invalidate
  `['tasks']` key.

## Routes

- `/dashboard/my-work` — list of assigned/in-progress tasks; tap a task
  → detail sheet.
- `/dashboard/jobs` — full available-jobs list with filters (location,
  priority, skill); `Take` buttons.
- `/dashboard/profile` — profile screen (below).
- `/dashboard/tasks/$taskId` — optional standalone detail route; the
  bottom-sheet detail on mobile may suffice for v1.

## Profile Screen

- Avatar (large), name, role/designation, email, employee code.
- Stats list (only rows backed by data; no fabricated numbers):
  - attendance summary (present/late/absent for month — exists in
    `getAttendanceSummary`)
  - task counts (assigned, in progress, completed — from tasks API)
  - performance row only when performance API returns data
- Settings/actions list: Notifications (link), Change password (deferred
  — link to auth flow when available), Sign out (existing flow).

## Mobile Attendance & Leave Screens

- **Attendance history** (`attendance-history.tsx`): render card list on
  mobile (`md:hidden`), keep the table on `md+` (`hidden md:block`) —
  CSS-only split, no `useIsMobile` needed. Card: date, shift, check-in,
  check-out, duration, status badge with correct colors for
  present/late/absent/excused/pending and incomplete checkout.
  Loading spinner, error state, and "No attendance records" empty state.
- **Leave history** (`leave-history.tsx`): segmented filter
  (All/Pending/Approved/Rejected) + card list on mobile, table on
  desktop. Include cancel action for `pending` leaves where supported.
- **Leave request** (`leave-request-form.tsx`): on mobile, open in a
  bottom sheet (`Sheet` from `src/components/ui/sheet.tsx`) triggered by
  a `+ Request Leave` button; inline field errors; confirm-before-discard
  when the sheet is closed with unsaved input. Desktop keeps the inline
  card.

## Accessibility & Mobile Details

- `env(safe-area-inset-bottom)` padding on `BottomNav` and
  `MobileShell` bottom padding.
- `touch-action: manipulation` on nav and FAB.
- `prefers-reduced-motion`: `motion` already used; add
  `useReducedMotion()` gates on new decorative animations (FAB bounce,
  card entrance).
- Tap targets ≥ 44px; icon-only buttons get `aria-label`.
- Dates/times via `Intl.DateTimeFormat` (follow existing
  `toLocaleDateString` usage).
- `tabular-nums` on durations and counts.
- Lists: keep renders small; virtualize only if pools exceed ~50 items.

## Data/State Notes

- React Query keys follow the existing pattern:
  `tasks.all`, `tasks.mine`, `tasks.available`, `tasks.detail(taskId)`.
- After `takeTask`/`completeTask`, invalidate `['tasks']` (and
  `['attendance']` for the home status strip if attendance is affected —
  it is not).
- Seeds: add demo tasks (assigned + available) and task requirements for
  the 4 demo users in `db/seed` so the dashboard is demonstrable.

## Out of Scope Verification

- No leave-balance UI until backend supports it.
- No hardcoded performance numbers; performance card renders only from
  real API data.
- FAB does not claim tasks and does not check in/out.
- Ineligible tasks never render with a `Take` button.

## Validation

Per implementation milestone, run:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Acceptance criteria:

1. A user only sees tasks they are eligible for in `Available Jobs`.
2. `takeTask` rejects ineligible users, already-claimed tasks, and
   capacity-exceeded users (server-enforced, unit tested).
3. Two concurrent `takeTask` calls on one task yield exactly one success.
4. Assigned tasks appear above available jobs on Home.
5. Attendance remains reachable from FAB and bottom nav, and performs no
   implicit check-in.
6. Employee and technician share the same layout; content differs by
   eligibility.
7. Attendance/leave screens render usable card lists on mobile, tables
   on desktop.

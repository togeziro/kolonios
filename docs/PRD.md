# Product Requirements Document

## Overview

Admin dashboard starter built with TanStack Start, shadcn/ui, Tailwind CSS,
and PostgreSQL. Targets SaaS apps, internal tools, and admin panels.

## Core Requirements

1. **Data tables** — Sorting, filtering, pagination, URL state sync with TanStack Table
2. **CRUD operations** — Products, users with server-side validation via Drizzle + React Query
3. **Kanban board** — Drag-and-drop task management with PostgreSQL persistence
4. **Notification center** — Badge count, preview popover, full page view
5. **Forms** — Multi-step, validation, file upload patterns with TanStack Form
6. **Authentication** — Email/password sign-in and sign-up with Better Auth DB sessions, RBAC, route protection
7. **Command palette** — Quick navigation (Cmd+K) via kbar
8. **Multi-theme** — Theme switching with local storage persistence

## Implemented Features

- **Dashboard Overview** — Analytics cards with Recharts graphs, Suspense-based loading; mobile staff layout for employees/technicians
- **Product Management** — CRUD with data table (search, filter, pagination, sort, URL state)
- **User Management** — Data table with role/status filters
- **Kanban Board** — Drag-and-drop task management with priority badges, PostgreSQL-backed via Drizzle + React Query
- **Notification Center** — Bell icon badge, popover preview, full page with tabs, PostgreSQL-backed via Drizzle + React Query
- **Attendance** — Check-in/out with geo-fencing (Haversine), today's status, attendance history; leave requests with type/date selection, leave history
- **Masterdata** — Full CRUD for departments and designations with dialog-based forms
- **Mobile Dashboard** — Responsive mobile layout for staff: 5-tab bottom nav, attendance shortcut FAB, task lists
- **RBAC** — 4 roles (admin, hr, employee, technician) with per-module permissions enforced at the RPC boundary
- **Forms** — Basic, multi-step, sheet/dialog, and advanced patterns with TanStack Form + Zod
- **Command Palette** — Cmd+K navigation via kbar
- **Multi-Theme Support** — 10+ themes with light/dark/system switching
- **Pre-commit Hooks** — oxlint, oxfmt --check, tsc on staged files
- **Testing** — Vitest + Testing Library unit & integration tests plus Playwright E2E
- **Authentication** — Better Auth email + password with DB sessions, RBAC (admin plugin), route protection
- **Mobile Work Dashboard** — Driver-style home for staff: assigned tasks first, eligibility-gated available-jobs pool (department/designation/location/skill), transactional task claiming, attendance status strip, 5-tab bottom nav, profile screen

## Technical Requirements

- TypeScript strict mode
- Server-only DB access via dynamic imports
- Automated testing (Vitest unit/integration + Playwright E2E)
- Pre-commit quality gates (lint, format, typecheck)
- PostgreSQL with Drizzle ORM
- Feature-based folder structure

## Security

The server-function boundary is hardened at every endpoint:

- **Authentication at the boundary** — every endpoint calls `requireSession()` (or `requireRole('admin')` for product/user writes) inside the handler, so endpoints cannot be reached unauthenticated over HTTP — independent of route guards (`beforeLoad`).
- **Input validation** — every server-function input is validated at runtime with a Zod schema via `@tanstack/zod-adapter`'s `zodValidator`. Schemas use `z.ZodType<ExistingType>` so they cannot drift from the request types.
- **Error mapping** — `lib/db/*.ts` wraps DB calls in `mapDbError`; unexpected errors become a generic message (no constraint/column names leak), while intentional `DomainError`s pass through.
- **Notifications IDOR** — Resolved 2026-07-23. All notification queries are scoped by `user_id`.

**Kanban** is intentionally shared across all authenticated users (team-wide Trello-style board).

## Roadmap

Directional buckets, not a strict timeline.

### Now

**Attendance Module (complete)**
- [x] Design attendance database schema (shifts, locations, employee_shifts, leaves, performance_reports)
- [x] Implement RBAC roles: `admin`, `hr`, `employee`, `technician`
- [x] Create `src/lib/db/schema/attendance.ts` and `src/lib/db/schema/masterdata.ts`
- [x] Update permissions with attendance-specific rules
- [x] Update session helpers with `requireHR()`, `requireEmployee()`, `requireTechnician()`
- [x] Generate and apply database migrations (`bun run db:push`)
- [x] Seed default data: locations, shifts, departments, designations, demo users
- [x] Create employee records linked to demo users
- [x] Implement attendance data access layer with Drizzle + Haversine geo-fence
- [x] Create check-in/check-out server functions with geo-fencing
- [x] Build attendance dashboard components (check-in card, history table, leave form)
- [x] Add leave management (cuti) with request form and history
- [x] Implement performance tracking (Laporan Kinerja) API
- [x] Mobile staff dashboard with task lists, 5-tab bottom nav, attendance shortcut FAB

**Masterdata Module (complete)**
- [x] Extend RBAC roles: `admin`, `hr`, `employee`, `technician`
- [x] Create employee management tables (employees, departments, designations)
- [x] Seed masterdata: 6 ISP departments, 13 designations, 4 employee records
- [x] Full CRUD from UI: departments and designations with dialog-based forms
- [x] Separate auth role (Access Level) from job title (Designation from DB) in user form
- [x] Tasks schema (tasks, task_requirements, employee_skills) with server-enforced eligibility
- [x] Driver-style mobile home (My Work + Available Jobs) with FAB attendance shortcut
- [x] Profile screen replacing the misleading Profile→notifications tab

### Next

- **Magic link auth** — passwordless signin + signup via single-use tokens

### Later

- **Production CI** — GitHub Actions running `bun run lint`, `typecheck`,
  `build`, and `db:migrate` against `tanstack_dashboard_test` on every PR.
- **Production deployment preset** — pick Vercel or Cloudflare via Nitro;
  wire `DATABASE_URL` migration runner into the deploy step.
- **Public API surface** — once deployment + magic link settle, expose
  server functions as documented stable contracts in [API.md](./API.md).
- **Observability** — request logs, server-fn error monitoring, Playwright
  trace archival.

### Won't (for this project)

- Social/SSO providers (Google/GitHub/etc.) — deferral is intentional.
  Infrastructure is provider-agnostic so wiring one later is a separate,
  contained change.
- 2FA / WebAuthn / passkeys — same reason.
- Multi-tenant isolation — single-tenant admin dashboard.

### Cross-references

- [TODO.md](./TODO.md) — task-level checklist for items above
- [CHANGELOG.md](./CHANGELOG.md) — time-ordered ship history
- [ARCHITECTURE.md](./ARCHITECTURE.md) — tech stack, data flow, patterns
- [API.md](./API.md) — server function reference

# Changelog

## [Unreleased — 2026-08-05]

### Payroll System

- **Payroll MVP** — Full payroll system implemented without overtime calculation and without new dependencies:
  - **Schema** — 13 new tables (`payroll_periods`, `payroll_records`, `payslips`, `payslip_rows`, `salary_assignments`, `salary_components`, `employee_salary_components`, `tax_profiles`, `employee_tax_profiles`, `benefit_enrollments`, `bank_accounts`, `employment_events`, `audit_log` payroll events) with enums, indexes, and relations
  - **Effective-dated data access** — Salary, tax, benefit, bank, and employment history resolved by period start date; overlap prevention on all create/update paths
  - **Calculation engine** — Pure function (`src/features/payroll/utils/calculator.ts`) supporting monthly/daily/hourly salary types, fixed/percentage/per-attendance/manual components, configurable absence/late/unpaid-leave deductions, progressive + TER tax methods, and serializable `calculation_snapshot`
  - **Server functions** — Full CRUD for components, profiles, periods, records; `generatePayrollFn`, `approvePayrollFn`, `markPayrollPaidFn`, `lockPayrollFn`; permission keys (`payroll.view`, `payroll.add`, `payroll.edit`, `payroll.approve`, `payroll.pay`, `payroll.reports`)
  - **Admin UI** — Overview dashboard, salary components, employee profiles, payroll periods, generate/review workflow, records with TanStack Table, reports with CSV/XLSX export
  - **Employee self-service** — PDF payslip via `pdf-lib` (company data from `payroll_records` snapshot, masked bank account), employee-scoped route (`/dashboard/payroll/payslips`), download with filename sanitization
  - **State machine** — `draft → processing → ready_to_pay → paid → locked`; locked periods are immutable
  - **Audit** — All payroll mutations recorded to `audit_log` via `withAudit` transaction wrapper; sensitive values (bank account numbers, tax identifiers) masked in payslip responses
  - **i18n** — All payroll UI strings translated EN/ID; no hardcoded strings
  - **Tests** — 617 tests passing (payroll unit, integration, E2E); typecheck, lint, i18n, build all clean

### TanStack Table Upgrade & Mobile Responsiveness Fix

- **TanStack Table implementation** — Upgraded all data tables to use TanStack Table v8 for consistency:
  - `src/features/role-groups/components/role-group-listing.tsx` — Full upgrade with filters, pagination, tabs, alert notifications
  - `src/features/attendance/components/admin-attendance-report.tsx` — Server-side pagination with TanStack Table UI
  - `src/features/audit/components/audit-log-page.tsx` — Client-side pagination (20 rows per page)
  - Created column definitions files: `feature-columns.tsx` for each feature
  - Added `lucide-react` dependency for icons

- **Mobile responsiveness fixes** — Fixed "desktop mode" feeling on mobile:
  - **Root cause** — flex layout chain (SidebarInset → InfobarProvider → PageContainer) had no `overflow-x-hidden` or `min-w-0`, so table `minWidth` style expanded the entire page
  - **Table horizontal scroll fix** — Applied upstream pattern: `style={{ minWidth: table.getTotalSize() }}` on Table components
  - **Overflow containment** — Added `overflow-x-hidden` + `min-w-0` to `SidebarInset`, `InfobarProvider`, and `PageContainer` to constrain table width within containers
  - **Table wrappers** — Added `overflow-x-auto` wrapper div around all tables
  - **Tailwind fixes** — Fixed invalid class `sm:w-82` → `sm:w-80`
  - **Result** — Tables now scroll horizontally on mobile without page feeling like desktop mode

- **Documentation** — Updated developer documentation:
  - Added "Mobile Responsiveness" section to `AGENTS.md`
  - Added "Mobile Responsiveness" section to `docs/TANASTACK_TABLE_GUIDE.md`
  - Created comprehensive TanStack Table guide (745 lines)

**Files modified:**
- `src/features/role-groups/components/role-group-listing.tsx` (major upgrade)
- `src/features/role-groups/components/role-group-columns.tsx` (new)
- `src/features/attendance/components/admin-attendance-report.tsx` (upgrade)
- `src/features/attendance/components/admin-attendance-columns.tsx` (new)
- `src/features/audit/components/audit-log-page.tsx` (upgrade)
- `src/features/audit/components/audit-log-columns.tsx` (new)
- `src/components/layout/page-container.tsx` (mobile fix)
- `AGENTS.md` (documentation update)
- `docs/TANASTACK_TABLE_GUIDE.md` (new comprehensive guide)

---

## [Unreleased — 2026-08-05 (Session 2)]

### Data Table Standardization & Column Pinning

- **Column pinning for actions** — Added `columnPinning: { right: ['actions'] }` to all masterdata tables for sticky action buttons on mobile horizontal scroll:
  - `src/features/masterdata/components/designation-manage-page.tsx` — Added `ColumnPinningState` type + pinning config
  - `src/features/masterdata/components/department-manage-page.tsx` — Added `ColumnPinningState` type + pinning config
  - `src/features/role-groups/components/role-group-listing.tsx` — Added `columnPinning` to `useReactTable` initialState

- **DataTable component upgrade** — Replaced custom table markup with `DataTable` component for consistency:
  - `src/features/role-groups/components/role-group-listing.tsx` — Replaced custom `<Table>` + custom pagination with `<DataTable table={table} />`, removed unused imports (`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Pagination`, `flexRender`)
  - `src/features/audit/components/audit-log-page.tsx` — Replaced custom table + pagination with `<DataTable table={table} />`, removed unused imports
  - `src/features/attendance/components/admin-attendance-report.tsx` — Replaced custom table + pagination with `<DataTable table={table} />`, added `onPaginationChange` wiring to `setFilters` for server-side pagination

- **DataTable minimum height fix** — Fixed table viewport visibility without fixed-height parent:
  - `src/components/ui/table/data-table.tsx` — Added `min-h-64` to table viewport div
  - `src/components/ui/table/data-table.test.tsx` — Added regression test for minimum height

**Files modified:**
- `src/features/masterdata/components/designation-manage-page.tsx` (column pinning)
- `src/features/masterdata/components/department-manage-page.tsx` (column pinning)
- `src/features/role-groups/components/role-group-listing.tsx` (DataTable upgrade + column pinning)
- `src/features/audit/components/audit-log-page.tsx` (DataTable upgrade)
- `src/features/attendance/components/admin-attendance-report.tsx` (DataTable upgrade)
- `src/components/ui/table/data-table.tsx` (min-h-64 fix)
- `src/components/ui/table/data-table.test.tsx` (new regression test)

---

## [Unreleased]

### TanStack alignment

- **Dependencies** — bumped `@tanstack/react-start` to 1.168.35, `@tanstack/react-router` to 1.170.18, `@tanstack/react-query` to 5.101.4, `@tanstack/react-form` to 1.33.3, `@tanstack/router-plugin` to 1.168.23; added `@tanstack/react-devtools` (centralized devtools panel).
- **CSRF protection** — `createCsrfMiddleware` now guards all server functions via `requestMiddleware` in `src/start.ts` (previously skipped because a custom `src/start.ts` existed).
- **Request-id plumbing** — request-id is now set by a global `requestIdMiddleware` instead of a per-server-fn `withRequestContext` wrapper; all `*/api/service.ts` handlers were de-wrapped.
- **Devtools** — React Query and Router devtools consolidated into a single `TanStackDevtools` panel.
- **Removed** — `kbar` command palette (dependency, components, search input, layout wiring).

### Attendance expansion

- **Work schedules** — `shifts` is now the master schedule; new `shift_weekday_rules`, `schedule_assignments`, `date_overrides`, `day_offs`, and `attendance_corrections` tables; effective-schedule resolution with day-off precedence.
- **GPS & selfie policies** — locations carry GPS validation/selfie/accuracy/staleness config; server rejects stale, inaccurate, or out-of-geofence check-ins; coordinates and validation state stored on attendance records.
- **Check-in/out** — employee card now supports browser location refresh, map preview, selfie capture, and translated GPS guidance.
- **Leave attachment policy** — `leave_type_configs` table; attachments enforced server-side (e.g. sick leave).
- **Corrections** — employees request check-in/out corrections; admins approve/reject with reason; before/after values recorded in `attendance_corrections` and the audit log (entity filter added).
- **Admin UI** — locations (MapLibre map + radius/policy), schedules (weekday rules), assignments (individual/bulk + day offs), and reports (filters + CSV/Excel/PDF export).
- **Dependencies** — added `maplibre-gl`, `@types/geojson`, `xlsx`, `pdf-lib`.
- **Deferred** — schedule-level GPS/selfie policy overrides are deferred; location-level policies apply.

### Attendance expansion — hardening (final review)

- **Server-enforced GPS & selfie** — check-in requires GPS coordinates when the location policy is enabled (omission rejected, not just bad values); check-out validation follows the policy stored on the record; selfie required server-side per policy.
- **Authorization** — admin attendance endpoints (reports, exports, assignments, corrections review) now require `attendance.edit`/`attendance.delete`, not `attendance.view`; admin route guards use a server RPC permission check in `beforeLoad`; nav gating moved to the `attendance_admin` module so employees with `attendance.view` can never reach admin pages.
- **Data integrity** — migration `0006_low_justice` adds unique constraints (shift weekday rule, one employee-shift per day) and FKs (day offs, date overrides, corrections).
- **Reports & exports** — report location filter fixed and wired to the UI; PDF export no longer truncates at 40 rows.
- **Audit coverage** — admin mutations (schedule override, day off, bulk assign, correction review) recorded to the audit log.
- **Seed/permissions** — HR role group granted `attendance: { view, edit }` (it operates the admin pages); Employee/Technician keep `attendance: { view }` only.
- **Check-out selfie UI** — the check-out branch now captures an optional selfie so users can satisfy selfie-required policies.
- **Residual hardening** — checkout selfie state reset after success, business timezone date defaults (WIB), official SheetJS distribution for XLSX export, HR `attendance.edit` documented as intentional.

### DB utilities refactoring & code quality improvements

- **Shared DB utilities** — extracted common patterns to `src/lib/db/utils.ts`:
  - `buildPagination()` - consistent pagination with clamping (1-100 limit)
  - `parseSort()` + `buildOrderBy()` - unified sorting logic
  - `buildSearchCondition()` - search across multiple fields
  - `buildStatusCondition()` - status filter helper
  - `buildConditions()` - WHERE condition builder
- **Refactored DB modules** — updated `customers.ts`, `employees.ts`, `masterdata.ts`, `attendance.ts`, `audit.ts`, `tasks.ts` to use shared utilities, reducing code duplication
- **Consistent error handling** — all DB functions now include `time` field in response envelope for consistency
- **Utilities test suite** — added `utils.test.ts` with 11 tests for shared DB utilities
- **TypeScript improvements** — fixed type errors and improved type safety across DB layer

### Authorization consolidation & integration preparation

- **Unified authorization model** — removed legacy helpers (`requireRole`, `requireMinRole`, `requireAdmin`, `requireHR`, `requireEmployee`, `requireTechnician`) from `src/lib/auth/session.ts`; all authorization now uses `requirePermission(module, action)` with `role_groups.is_admin` as the single admin bypass
- **Admin bypass fix** — `requirePermission()` now loads role group first and checks `is_admin` flag; temporary backward compatibility for admin users without role group assignment (with console warning)
- **Integration layer scaffolded** — added `src/integrations/` directory with Tripay payment adapter (client, types, webhook verification) and MikroTik RouterOS adapter (scaffolding)
- **Tripay webhook handler** — implemented at `src/routes/api/v1/payments/webhook.ts` with HMAC signature verification and payment record storage (`payments` schema)
- **CRUD standardization** — verified products feature follows standard pattern; created `docs/superpowers/guides/crud-standardization.md` guide for contributors
- **Test suite updated** — 465 tests passing after authorization refactoring

### Full UI i18n migration (12-task plan)

- **All functional UI is now translatable EN/ID** — every user-facing string in
  the dashboard (navigation, overview cards, table headers/rows, forms, toasts,
  pagination, dropdowns, modals/sheets, auth pages, notifications, attendance,
  tasks, masterdata, role groups, profile) migrated from hardcoded JSX text to
  `useTranslation()`/`t()` calls backed by `src/i18n/locales/{en,id}/translation.json`
  (510 keys, key-parity enforced by `bun run i18n:check`).
- **Language persistence fixed** — the i18next cookie is now read during SSR so
  a hard refresh keeps the selected language; `<html lang>` reflects it.
- **Codebase remains English-only** — Indonesian appears only as values in
  `id/translation.json`; keys, identifiers, and comments stay English.
- **Baseline regenerated** — hardcoded-string scanner allowlist
  (`scripts/i18n-hardcoded-baseline.txt`) trimmed 522 → 115 entries; the
  remainder are legal pages (terms/privacy/about, intentionally never touched),
  non-translatable component/chart props, column-header translation keys, and
  demo placeholders. `bun run i18n:hardcoded` passes against the new baseline.

## [Unreleased — 2026-08-01]

### Reliability & CRUD refetch fixes

- **Mutation callbacks now chain** — new `mergeMutationCallbacks(options, extra)`
  helper (`src/lib/mutation-options.ts`) composes `onSuccess`/`onError` instead
  of overriding the base options. 11 CRUD components (role-groups, users,
  employees, products, customers) had `useMutation({ ...base, onSuccess })`
  spread overrides that silently replaced the base `onSuccess`, so
  `invalidateQueries()` never ran and lists stayed stale until manual refresh.
  Fix verified with 4 unit tests (TanStack Query v5 `onSuccess` signature).
- **User form role group `''` value fixed** — Radix `Select.Item` forbids an
  empty-string value; the "No role group" option now uses a `NO_ROLE_GROUP =
  'none'` sentinel that converts back to `undefined` on submit, fixing the
  console error when editing a user without a role group.
- **Auto-seed on fresh migrations** — `db:migrate:run` now seeds the database
  automatically when no data exists, so a fresh checkout works with just
  `db:push`/`db:migrate:run` (no manual `db:seed`).
- **CI fixes** — `format:check` restored to a non-flaky job and coverage
  threshold CI step fixed; oxfmt now formats `scripts/**` (lint-staged no
  longer fails on script files).

## [Unreleased — 2026-08-01]

### API Documentation (OpenAPI + Redoc)

- **Zod → OpenAPI** — added `zod-openapi`; `src/lib/api/openapi.ts` is a typed
  registry of 32 operations that reuses the actual request/response Zod schemas
  from `src/features/*/api/validation.ts`, so docs and runtime validation share
  one source of truth.
- **Redoc** — `@redocly/cli` bundles the spec into `public/api-docs.html`
  (self-contained, works offline on a local VPS). `bun run api:docs` generates
  both `openapi.json` and the HTML; `bun run build` runs it automatically.
- `requirePermission` now loads the caller's role group via `createServerOnlyFn`,
  which strips the `@/lib/db/role-groups` (and `postgres`) import from the
  client bundle. **Fixes a production build regression** introduced in the
  role-groups commit where the `postgres` driver leaked into the client bundle
  (`"performance" is not exported by __vite-browser-external`).
- **i18n debt cleared** — role-group listing/permissions pages and the user
  form sheet now use `useTranslation` (28 new keys, en+id). The hardcoded-string
  scanner also ignores non-user-facing component props (`variant`, `size`, `to`,
  `form`, `asChild`), cutting the baseline 522 → 421 entries.
- **Versioned migrations** — added `scripts/baseline-migrations.ts` +
  `db:baseline` to adopt versioned migrations on the `db:push`-created dev DB;
  migration `0003_daily_exodus` versions `role_groups` + `user_role_groups`.

## [Unreleased — 2026-08-01]

### RBAC: Role Groups (DB-backed permission matrix)

- **New tables** — `role_groups` (name, description, JSONB `permissions`, `is_admin`) + `user_role_groups` junction (`src/lib/db/schema/`); seeded with 4 groups (Administrator, HR, Employee, Technician).
- **Role group management UI** — `/dashboard/admin/role-groups`: listing, create/edit form sheet, per-module permission toggles page, delete guard (prevents removing the last admin group).
- **Access Level = role group** — user form assigns a role group instead of a raw role; users table shows the group name; `user.role` stays in sync via `mapRoleGroupToLegacyRole`.
- **Server guard** — `requirePermission(module, action)` in `src/lib/auth/session.ts` resolves the caller's group permissions from the DB (admin role and `is_admin` groups bypass); pure `hasModulePermission` helper is unit-tested.
- **Client parity** — `useRoleGroupPermissions` + nav filtering read the same permission map, so sidebar visibility can never drift from server enforcement.
- **Migration** — all feature services (attendance, tasks, notifications, audit, users, employees, products, customers, role-groups, masterdata) now use `requirePermission` instead of `requireRole`/`requireMinRole`; legacy guards retained for compatibility.
- **Tests** — 13 new unit tests for `hasModulePermission`/`requirePermission`; total 481 passing (52 files).
- **Bug fix** — `resetAllTables` in `src/test-utils/db.ts` now clears `user_role_groups` before `role_groups` (FK violation); user schema tests updated for optional `role`/`role_group_id`.



### Audit

- **Follow-up repository audit completed** — spec
  `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md`; summary
  `docs/audit/2026-07-31-follow-up-summary.md`. Health score 79 → 87.
- Removed demo/showcase pages (forms, react-query, elements) from routes and nav.
- Notifications: 30 s polling via React Query; delivery design documented.
- Sentry integration (DSN-gated) + `x-request-id` correlation middleware.
- `audit_log` table + `withAudit()` on admin/staff writes + `/dashboard/admin/audit-log`.
- RBAC: `requireRole` exact sets (employee/technician split), `requireMinRole`, customer role.
- API.md rewritten: all 43 server functions with required roles.
- i18n enforcement: `i18n:check` key parity + hardcoded-string scanner (baseline allowlist).
- 70% coverage threshold enforced in CI.
- Better Auth rate limiting + per-user write rate limits.
- `src/lib/uploads.ts` validation helper for future upload features.
- Notification id payloads now use string ids with server-side coercion.

### Mobile Work Dashboard

- **Driver-style home** — Assigned-first My Work + eligibility-gated Available Jobs pool (department, designation, location, skill); transactional `takeTask` claim with capacity limit; ineligible tasks listed without actions
- **Navigation** — Bottom nav now Home | My Work | Attendance | Leave | Profile; FAB is an attendance shortcut (no implicit check-in)
- **Mobile screens** — Attendance/leave history as card lists on mobile (tables on desktop); leave request via bottom sheet; profile screen with month summary

## [Unreleased — 2026-07-30]

### Audit

- **Repository audit conducted** — Full report at `docs/audit/2026-07-30-repository-audit.md`
- **Health score: 74/100** overall; 6 test files covering 3 modules, 5+ modules uncovered
- **Critical findings**: `notifications.user_id` nullable (data integrity), `generateCustomerCode` race condition
- **Prioritized improvement plan** created — 5 phases from quick wins to i18n polish
- **TODO.md updated** with Phase 1–5 action items derived from audit findings

### Audit Implementation (Completed)

- **Error handling** — `DomainError` now includes `code` property; `mapDbError` wraps unknowns with `INTERNAL_ERROR`; replaced `console.error` with structured logging
- **Loading states** — Added `LoadingSkeleton` component with `className` and per-row height array support; integrated into `ProductListingPage`
- **Test coverage** — Added integration tests for attendance, customers, employees, masterdata (+188 tests); extracted masterdata validation schemas (+47 tests); total 239 passing, 1 skipped
- **API versioning** — Added `/api/v1` prefix via `src/lib/api/version.ts`; updated `api-client.ts` and auth route
- **Structured logging** — Added `pino` + `pino-pretty`; `logger` instance with env-configurable level; integrated with error handler
- **Environment docs** — Added `.env.example` with all required variables and descriptions
- **Database migrations** — Added `scripts/migrate.ts` and `db:migrate:run` script for programmatic migration execution
- **Rate limiting** — Added `rate-limiter-flexible` with memory store; `checkRateLimit` function sets HTTP 429 status; integrated with `checkInFn`
- **CI/CD** — Verified existing GitHub Actions workflow covers lint, typecheck, test, build
- **Dependency cleanup** — Removed `react-resizable-panels` and `i18next-browser-languagedetector` (unused)

### Dependencies

#### Major Updates
- **Recharts** ^2.15.4 → ^3.10.0 — Major version upgrade with new components
- **react-resizable-panels** ^2.1.9 → ^4.12.2 — Major version upgrade
- **@types/node** ^22.12.0 → ^26.1.1 — TypeScript type definitions update
- **@faker-js/faker** ^9.9.0 → ^10.5.0 — Fake data generator major update

#### Minor Updates
- **sonner** ^1.7.4 → ^2.0.7 — Toast notification library update
- **vite-tsconfig-paths** ^5.1.4 → ^6.1.1 — Vite plugin for tsconfig paths
- **@testing-library/jest-dom** ^6.9.1 → ^7.0.0 — Jest DOM matchers update

### Added

- **Attendance schema** — New database tables for attendance management:
  - `locations` — Company office locations for geo-fencing (name, latitude, longitude, radius)
  - `shifts` — Employee shift definitions (name, start_time, end_time)
  - `employee_shifts` — Daily attendance records (check-in/out times, location locks)
  - `leaves` — Leave request system with types: annual, sick, personal, emergency
  - `performance_reports` — Performance tracking with score and running_average
  - `attendances` — Attendance history view

- **Masterdata schema** — New tables for employee management:
  - `employees` — Employee profiles linked to Better Auth users
  - `departments` — Company department structure
  - `designations` — Job titles/positions

- **RBAC extensions** — New roles in `permissions.ts`:
  - `hr` role — Attendance read/update, leave management, employee read
  - `employee` role — Self-service attendance check-in, view own history
  - `technician` role — Field worker equivalent to employee

- **Attendance documentation** — New `ATTENDANCE.md` with schema docs, API patterns, and security guardrails

- **Seed data for attendance module** — Extended `scripts/seed.ts` with:
  - Default locations: Head Office, Branch Office 1 (with coordinates)
  - Default shifts: Morning (08:00-17:00), Afternoon (13:00-22:00), Night (22:00-06:00)
  - Default departments: Engineering, Operations, HR
  - Default designations: Software Engineer, Senior Software Engineer, Operations Specialist, HR Specialist
  - Demo users: admin, hr, employee, technician (all with `Password123!`)
  - Employee records linked to all demo users

- **Session helpers** — Updated `src/lib/auth/session.ts` with role-specific helpers:
  - `requireHR()` — Requires admin or hr role
  - `requireEmployee()` — Requires admin, hr, employee, or technician role
  - `requireTechnician()` — Requires admin, hr, employee, or technician role

### Changed

- **Removed

- **Static font loading removed** — All 9 font `@import` statements removed from `globals.css`. Fonts are now dynamically loaded per-theme via `src/lib/fonts.ts`, which maps each theme to its required fonts and uses Vite dynamic `import()` to inject font-face CSS on demand. Themes with no external font dependencies (Claude, WhatsApp) load zero fonts. Instead of downloading all 9 font packages (~hundreds of KB) on every page load, only the current theme's fonts are fetched.

### Changed

- **Codebase cleanup (spaghetti reduction)**: Applied a 10-task refactor across 4 passes:
  - Extracted shared `AuthShell` (v1 sign-in/sign-up) and `AuthCard` (v2 routes) — removed ~4 duplicated auth layouts.
  - Deduplicated product Zod schema + category options into the canonical `features/products` sources; fixed a latent lowercase-vs-uppercase category enum bug in the demo forms; dropped an `as any` cast.
  - Relocated `fetchGitHubRepo`/`formatCount` to `lib/github.ts` and `GitHubIcon` to `icons.tsx`.
  - Removed dead `useEffect` in `app-sidebar.tsx`; extracted shared `FilterClearButton` from 3 table-filter components; extracted `PasswordField` from auth forms; extracted `parseFilterValuesFromSearch`/`buildFilterSearchParams` from `use-data-table.ts` into `lib/parsers.ts`; split the 755-line `infobar.tsx` into 5 cohesive modules; extracted `ComboboxField`/`TagsField`/`SectionTitle` from `demo-form.tsx`; added `getProductOr404` helper to dedupe the load-row preamble in `db/products.ts`.

- **Auth**: Swapped custom JWT (`bcryptjs`, `jose`) for Better Auth.
  - Added `better-auth` + `@better-auth/drizzle-adapter` deps; removed `bcryptjs`, `jose`, `@types/bcryptjs`.
  - Generated Better Auth schema tables (`user`, `session`, `account`, `verification`).
  - New auth server config with `admin` plugin + `tanstackStartCookies`.
  - New auth client, permissions module, `/api/v1/auth/$` route handler.
  - Deleted old `src/lib/auth/server.ts` and `src/lib/auth/client.tsx` (AuthProvider/useAuth).
  - Sign-in/register forms now call `authClient.*` directly.
  - Dashboard `beforeLoad` uses Better Auth session via `ensureSession`.
  - Dropped old `users` table + `user_role`/`user_status` enums (migrations 0005–0006).
  - Users data-access layer rewritten to use Better Auth admin API.
  - Seed script no longer seeds users.
  - Password fields on sign-in and register forms now have a show/hide eye toggle.

### Added

- Seeded a demo admin account `admin@example.com` / `Password123!` via `scripts/seed.ts` (`seedUsers`), so login can be tested immediately after `db:seed` (idempotent — skips if the email already exists).

### Fixed

- **Login 404/403** — Fixed by setting `basePath: '/api/v1/auth'` on both Better Auth client and server, aligning the client's request path with the server's mount point. No longer requires a patch to TanStack Start's `createStartHandler.js`.
- **Better Auth "Invalid origin" 403** — `baseURL` now uses a dynamic `allowedHosts` + `protocol: 'auto'` config (replaces the hardcoded `http://localhost:3000`) so Caddy-served dev hosts pass the CSRF origin check.
- **SSR restore (framework realignment)** — replaced the deprecated `@tanstack/react-router-with-query` (`v1.130.17`, incompatible with Router `v1.170.17`) with the official `@tanstack/react-router-ssr-query` (`v1.167.1`) and wired `setupRouterSsrQueryIntegration({ router, queryClient })` in `src/router.tsx`. Fixes the `isDehydrated` crash during SSR streaming.
- **`Buffer is not defined` client crash** — the `postgres` driver was reaching the browser bundle; `vite.config.ts` now aliases `Buffer → 'buffer'` and defines `global → globalThis`.
- **`data-theme="[object Object]"`** — `__root.tsx` loader now reads the active theme via `createServerOnlyFn` (imports `@tanstack/react-start/server` server-side only).
- **Users page 500** — `getUsers`/`createUser`/`updateUser`/`deleteUser` now pass `getRequestHeaders()` into every `auth.api.*` admin call, fixing `Dynamic baseURL could not be resolved`.
- **Notifications `filter is not a function`** — components now read `data?.notifications` (the query returns `NotificationsResponse`, not a bare array) and type it as `NotificationItem[]`.
- **Auth middleware TS error** — `authMiddleware` is now `.server()`-only (removed the `.client()` chain).
- **Data routes** — `product`, `users`, `kanban`, `notifications`, `overview` now use a `loader` that calls `queryClient.ensureQueryData(...)` with `ssr: 'data-only'`, so data prefetches on the server and hydrates on the client.

### Changed — Codebase Audit (2026-07-23)

- **Dead code identified for removal** (~530 lines across 10 files):
  - 9 unused component files: `src/components/nav-main.tsx`, `nav-projects.tsx`, `nav-user.tsx`, `github-stars-button.tsx`, `form-card-skeleton.tsx`, `user-avatar-profile.tsx`, `button-group.tsx`, `frame.tsx`, `resizable.tsx`
  - 1 unused hook: `src/hooks/use-media-query.ts` (duplicate of `useIsMobile`)
  - All 10 files deleted.
- **Dependency cleanups**:
  - Replaced `radix-ui` umbrella imports with individual `@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-separator`; removed `radix-ui` from package.json.
- **Duplicate auth routes retired**: V1 routes (`/auth/sign-in`, `/auth/sign-up`) deleted; redirects updated to point to `/auth/v2/sign-in`. Orphaned V1 components (`sign-in-view.tsx`, `sign-up-view.tsx`) deleted.
- **Duplicate "isMobile" hooks**: `useIsMobile` (`use-mobile.tsx`) and `useMediaQuery` (`use-media-query.ts`) both hardcode 768px. The latter is unused and deleted.
- **Theme/font fix**: Added 3 missing `@fontsource` imports to `globals.css` — `architects-daughter` (Notebook), `merriweather` (Astro Vista), `space-mono` (Neobrutualism). These fonts were installed but never loaded via `@import`, causing theme fonts to fall back to system defaults.
- **Kanban modular split**: Extracted `kanban.tsx` (1021 lines) into 7 files under `src/components/ui/kanban/` — `contexts.ts`, `root.tsx`, `board.tsx`, `column.tsx`, `item.tsx`, `overlay.tsx`, `index.ts`. Preserved all exports and import paths.
- **Demo form relocation**: Moved `demo-form.tsx` (695 lines) from `src/components/forms/` to `src/features/forms/` (more accurate feature placement). Updated all imports.

All changes above are committed on `dev` (HEAD `1ed928a`).

> **2026-07-23 update (post-compaction):** Pre-commit hooks activated, notifications IDOR fixed, docs realigned.

## [Unreleased after compaction]

### Security

- **Notifications IDOR fixed** — `user_id` column added to `notifications` schema.
  - Migration `0007_blue_mister_sinister.sql`: `ALTER TABLE notifications ADD COLUMN user_id text;`.
  - All five data-access functions (`getNotifications`, `markAsRead`, `markAllAsRead`, `addNotification`, `removeNotification`) now accept `userId` and scope queries with `AND user_id = ?`.
  - Server-function service layer threads `session.user.id` through every call.
  - Seed script assigns notifications to the demo admin user.
  - Cross-user isolation verified by 3 new integration tests.
  - Added `fallback: 'http://localhost:3000'` to Better Auth baseURL config so seed scripts resolve the Dynamic baseURL error.

### Infrastructure

- **Pre-commit hooks activated** — `npx simple-git-hooks` now runs `lint-staged && tsc --noEmit` on every commit.
- **Roadmap realigned** — PRD.md Now/Next/Later buckets rewritten to match current state. TODO.md restructured to match.
- **Font cleanup** — removed 2 unused font packages (`@fontsource-variable/playfair-display`, `@fontsource/merriweather`) that were imported but not referenced by any theme.

### Fixed

- **Kanban route module-load error** — "Failed to fetch dynamically imported module" on `/dashboard/kanban`. Root cause: stale Vite module graph cache from `src/components/ui/kanban.tsx` (1021-line monolith) being refactored into `src/components/ui/kanban/` (directory with `index.ts`). Vite still resolved `@/components/ui/kanban` imports to the old dead file path `/src/components/ui/kanban.tsx` (404), breaking the dynamic import chain for the kanban route component chunk. Fixed by restarting the Vite dev server to clear the resolution cache.

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Attendance frontend (complete)** — Check-in/out with geo-fencing, leave requests, attendance history:
  - `src/features/attendance/` — Types, Zod validation, React Query options + key factory
  - `checkInFn` / `checkOutFn` — Server functions with Haversine geo-fence validation
  - `getMyAttendanceFn` / `getAttendanceHistoryFn` — Today's attendance + historical records
  - `getMyLeavesFn` / `createLeaveRequestFn` — Leave list + create
  - `getPerformanceStatsFn` / `getLocationsFn` / `getShiftsFn` — Supporting queries
  - Routes `/dashboard/attendance` and `/dashboard/leave`
  - Components: `AttendanceCheckCard`, `AttendanceHistory`, `LeaveRequestForm`, `LeaveHistory`
  - Navigation shortcuts: Attendance (a,a), Leave (l,l) in Overview group

- **Mobile layout for staff** — Responsive dashboard with mobile-first components:
  - `useIsMobile` hook — Media query based responsive detection
  - `MobileHeader` — Avatar + greeting + notification badge + sign-out dropdown
  - `MobileAttendanceSummary` — Circular progress + check-in/out card
  - `InProgressTasks` — Horizontal scroll task cards
  - `TaskGroups` — Department group list with progress circles
  - `BottomNav` + FAB check-in button — Fixed bottom navigation
  - `MobileShell` — Mobile layout wrapper (header + outlet + bottom nav)
  - `StaffMobileDashboard` — Combines all mobile fragments for staff home
  - Conditional render in `/dashboard/overview` and `dashboard.tsx` based on role + screen size

- **Masterdata CRUD from UI** — Department and designation management:
  - `src/features/masterdata/` — Server functions, queries, admin components
  - Full CRUD: create/update/delete for departments and designations
  - Routes `/dashboard/admin/departments` and `/dashboard/admin/designations`
  - Dialog-based forms with TanStack Table display
  - Navigation: Admin group with Departments and Job Titles
  - User form separates "Access Level" (auth role) from "Job Title" (designation from DB)

- **Seed data expanded** from 3 departments/4 designations to 6 ISP departments/13 designations:
  - Departments: Engineering, Operations, Sales & Marketing, Customer Service, Finance & Billing, HR & Administration
  - Designations: NOC Engineer, Network Engineer, Senior Network Engineer, Field Technician, Senior Field Technician, Installation Specialist, Sales Agent, Sales Supervisor, Customer Service Rep, Support Engineer, Billing Specialist, Finance Officer, HR Specialist
  - 4 demo users: admin, hr, employee, technician (all with `Password123!`)
  - 2 locations (Head Office, Branch Office 1), 3 shifts (Morning, Afternoon, Night)

### Fixed

- **Auth client React import** — Changed from `better-auth/client` (vanilla atom-based) to `better-auth/react` so `useSession` returns `{ data, isPending, error, refetch }` instead of an `Atom` store. Fixes TS2349 type errors in mobile-header, dashboard.tsx, and overview.tsx.

### Changed

- **AUTH_ROLE_OPTIONS** — Renamed from `ROLE_OPTIONS` to clarify these are auth roles, not job titles. User form now has separate "Access Level" (admin/hr/employee/technician) and "Job Title" (DB designation) fields.

### Internationalization (i18n) with i18next — Full i18n support using `i18next` + `react-i18next`:
  - `src/i18n/config.ts` — i18n instance factory with SSR support, resources for EN/ID
  - `src/i18n/provider.tsx` — `I18nProvider` component + `getServerSideI18n` for SSR
  - `src/i18n/types.ts` — TypeScript type augmentation for typed translation keys
  - `src/i18n/locales/en/translation.json` — English base translations (navigation, forms, auth, etc.)
  - `src/i18n/locales/id/translation.json` — Indonesian translations
  - `src/components/language-switcher.tsx` — Language dropdown selector in header
  - `src/routes/__root.tsx` — SSR language detection via cookie + Accept-Language header, dynamic `<html lang>`
  - `src/components/icons.tsx` — Added `globe` icon
  - Dependencies: `i18next`, `react-i18next`, `i18next-browser-languagedetector`

### Changed

- **Language detection** — Cookie `i18next` → Accept-Language header → fallback `en`
- **LanguageSwitcher** — Moved from app-sidebar dropdown menu to header (next to ThemeModeToggle)
- **Removed CtaGithub** — Deleted `src/components/layout/cta-github.tsx` and removed from `header.tsx`

## [0.1.0]

### Added

- JWT cookie-based auth with `bcryptjs` password hashing — server functions (`signInUserFn`, `signUpUserFn`, `getSessionFn`, `signOutUserFn`), `AuthProvider`/`useAuth()` context, `beforeLoad` route protection on `/dashboard`
- V1-style auth pages — 1/3 + 2/3 split-screen layout for sign-in and sign-up (replaces old placeholder pages)
- V2-style auth pages — 50/50 branded split-screen with centered card form at `/auth/v2/sign-in` and `/auth/v2/sign-up`
- Password field + "Remember me" checkbox in login form with `@tanstack/react-form` + Zod
- Register form with first/last name, email, password + confirm (Zod `.refine()` validation)
- `password_hash` column added to `users` table (migration `0004_flowery_steel_serpent`)
- Auth architecture docs — see [API.md](./API.md)

### Fixed

- Empty `AUTH_SECRET` now throws on startup instead of signing tokens with an empty key
- Auth handler bodies wrapped in try/catch — safe error logging, no stack leaks to client
- Signup TOCTOU race removed — catches PostgreSQL unique constraint violation instead of pre-check
- Email now lowercased/trimmed on both signup and signin for case-insensitive login
- "Remember me" checkbox now controls cookie `maxAge` (1 day unchecked, 30 days checked)
- `payload.sub` guarded — JWT without `sub` returns null session instead of crashing
- `serializeUser` types simplified to avoid Drizzle `PgColumn` type leaking into client

### Added

- PostgreSQL database layer with Drizzle ORM (products, users, kanban tables)
- Server-only data-access modules with dynamic imports
- Seed script for products (20), users (50), kanban board (4 columns, 10 tasks)
- Pre-commit hooks via simple-git-hooks + lint-staged (oxlint, oxfmt --check, tsc)
- React Query DevTools in root layout
- Kanban board migration from Zustand to PostgreSQL (schema, server functions, React Query)
- Input validation on kanban server functions
- FK constraint on kanban_tasks.column_slug
- Form reset and empty-title validation in new task dialog
- Race condition protection on kanban drag-drop mutations
- Cleanup of debounce timers on component unmount
- Testing setup: Vitest + Testing Library unit & integration tests for schemas, form validation, table parser, and product/user/kanban data-access against dedicated test DB
- `vite.config.ts` test configuration (test block, vitest.setup.ts with test DB env)
- `scripts/create-test-db.ts` and `src/test-utils/db.ts` helper for test isolation
- Added test scripts: `test`, `test:run`, `test:coverage`
- Playwright E2E tests (`e2e/`) for product CRUD (create/update/delete) and table sorting, plus `e2e` and `e2e:install` scripts and `playwright.config.ts` (auto-starts dev server, single worker to avoid DB races)

### Changed

- Removed deprecated `baseUrl` from tsconfig.json
- Upgraded lib target to ES2023

### Fixed

- Stale closure in kanban store (dbColumns captured via ref)
- Optimistic state not clearing on mutation error
- Null check on addTask database result
- Input validation in `getProducts`: page/limit clamped to safe ranges, categories filter normalized via `Array.isArray` + enum filtering, replacing `String()` garbage coercion
- Input validation in `createProduct`/`updateProduct`: `validateCategory()` guard replaces unsafe `as ProductCategory` cast; `validatePrice()` guard prevents null/NaN from reaching DB as `"null"`/`"NaN"` strings

### Removed

- Chat feature (routes, components, nav entry, notification mock) — decommissioned
- Dead chat leftovers: `open-chat` actionRoutes in notification center, `chat: IconMessage` icon alias, `IconMessage` import
- Zustand dependency — last consumer (notification center mock store) replaced with PostgreSQL + React Query

### Added

- Notification Drizzle schema (`notification_status` enum, `notifications` table with JSONB actions)
- Notification data-access layer (`src/lib/db/notifications.ts`)
- Notification server functions (`createServerFn`) — `getNotificationsFn`, `markAsReadFn`, `markAllAsReadFn`, `addNotificationFn`, `removeNotificationFn`
- Notification React Query keys, query options, and mutation options
- Notification integration tests (7 tests covering CRUD, status updates)
- Notification seed data (8 entries in `scripts/seed.ts`)
- DB migration `0003_cheerful_rumiko_fujikawa` (notifications table)
- `drizzle.config.ts` now uses explicit schema file list (avoids picking up `.test.ts` files)

### Changed

- Notification center components (`notification-center.tsx`, `notifications-page.tsx`): swapped Zustand store for `useQuery` + `useMutation`
- Deleted `src/features/notifications/utils/store.ts` (Zustand mock store) — no longer needed

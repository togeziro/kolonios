# Project Todo List

## Completed (2026-08-05 — Payroll system)

- [x] Payroll schema and migration (`src/lib/db/schema/payroll.ts`, 13 tables, enums, indexes, relations)
- [x] Effective-dated data access layer (`src/lib/db/payroll.ts`) with salary/tax/benefit/bank/employment resolution
- [x] Pure calculation engine (`src/features/payroll/utils/calculator.ts`) — monthly/daily/hourly, fixed/percentage/per-attendance/manual components, configurable absence/late/unpaid-leave deductions, progressive + TER tax, zero overtime seam, serializable snapshot
- [x] Validated server functions and client hooks (`src/features/payroll/api/service.ts`, `validation.ts`, `queries.ts`, `mutations.ts`, permission keys, React Query, i18n)
- [x] Admin payroll UI (overview, components, profile, periods, generate/review, records with TanStack Table, reports with CSV/XLSX export)
- [x] Employee payslip and self-service (PDF via pdf-lib, HTML template, masked bank data, employee-scoped payslip route, download)
- [x] Seed data, audit events, and E2E verification
- [x] Documentation (PAYROLL_WORK_PLAN.md, design spec, implementation plan, this TODO updated)

## Completed (2026-08-04 — Attendance expansion)

- [x] Master work schedules: `shifts` + `shift_weekday_rules` + `schedule_assignments` + `date_overrides` + `day_offs` with effective-schedule resolution (day-off precedence)
- [x] GPS & selfie policies on locations (`gps_validation_enabled`, `selfie_required`, `max_accuracy_meters`, `max_stale_ms`) enforced server-side
- [x] Check-in/out card: location refresh, MapLibre preview, selfie capture, translated GPS guidance
- [x] Leave attachment policy (`leave_type_configs`, server-enforced for e.g. sick leave)
- [x] Correction requests: employee request → admin approve/reject; `attendance_corrections` + audit log (entity filter)
- [x] Admin UI: locations, schedules, assignments (individual/bulk + day offs), reports (filters + CSV/Excel/PDF)
- [x] Hardening: report/export gated to `attendance.edit`; migration `0006` unique constraints + FKs; HR granted `attendance.edit`; check-out selfie capture; audit coverage on all admin writes
- [x] Docs updated (README, PRD, ARCHITECTURE, API, ATTENDANCE, CHANGELOG); e2e specs for attendance (admin + employee)

## Completed (2026-08-01)

### Role Groups RBAC (DB-backed permission matrix)

- [x] `role_groups` + `user_role_groups` tables (JSONB permissions, is_admin)
- [x] Role group CRUD UI + per-module permission toggles (`/dashboard/admin/role-groups`)
- [x] Access Level (user form) = role group; users table shows role group
- [x] `requirePermission(module, action)` server guard + `hasModulePermission` pure check (13 new tests)
- [x] Client sidebar driven by the same permission map (`useRoleGroupPermissions`)
- [x] All feature services migrated from `requireRole`/`requireMinRole` to `requirePermission`
- [x] Seed: 4 role groups (Administrator, HR, Employee, Technician) + assignments
- [x] Docs updated (README, PRD, ARCHITECTURE, API, ATTENDANCE, CHANGELOG)

### Reliability & CRUD refetch (2026-08-01)

- [x] `mergeMutationCallbacks` helper chains base `onSuccess`/`onError` so `invalidateQueries()` always runs (4 unit tests)
- [x] Refactored 11 CRUD components from spread-override `{ ...base, onSuccess }` to `mergeMutationCallbacks`
- [x] User form "No role group" option uses `NO_ROLE_GROUP = 'none'` sentinel (fixes Radix empty-string `Select.Item` error)
- [x] Auto-seed on fresh migrations (`db:migrate:run` seeds when empty)
- [x] CI: `format:check` job de-flaked, coverage-threshold step fixed, oxfmt now covers `scripts/**`

## Completed (2026-07-31 follow-up audit)

- [x] Phase 0 — Archive 2026-07-30 audit, reconcile TODO
- [x] Phase 1 — Kanban doc cleanup, delete demo pages, dead upload UI, notification id types, i18n key prune
- [x] Phase 2 — Notifications polling (refetchInterval 30s) + NOTIFICATIONS.md
- [x] Phase 3 — Sentry + request-id middleware + error boundary standard
- [x] Phase 4 — audit_log table + withAudit + admin audit-log route
- [x] Phase 5 — RBAC fixes (requireRole sets, requireMinRole, customer role)
- [x] Phase 6 — API.md rewrite, i18n enforcement scripts, 70% coverage, uploads helper
- [x] Phase 7 — Better Auth rate limit + per-user write rate limits
- [x] Phase 8 — Health-score summary, CHANGELOG, README

## Completed (prior audits)

- 2026-07-30 audit (archived): error handling DomainError, LoadingSkeleton,
  +188 tests, API versioning /api/v1, pino logging, .env.example, migration
  workflow, checkInFn rate limit, CI verified, dependency cleanup.
- Kanban feature: fully removed from code, schema, migrations, seed, routes.
  (Only stale mention was docs/API.md §Kanban — removed in Phase 1.)

## Deferred / Future

- [ ] WhatsApp notification channel + attendance reminders (late check-in, leave approval)
- [ ] Schedule-level GPS/selfie policy overrides (deferred from attendance expansion; location-level policies apply today)
- [x] Replace `xlsx` npm package with the official SheetJS distribution via export adapter (npm `xlsx@0.18.5` carries known advisories)
- [x] E2E for the check-out selfie path (rejection + success, selfie_required policy; unit tests + Playwright)
- [ ] Migrate custom MapLibre wrapper to mapcn when the registry is available
- [ ] Keep dev + test DB migrations in sync via `db:push`/`db:migrate:run` (manual workflow)
- [ ] Masterdata extended: invoices, payments, ticket support system
- [ ] Customer self-service portal (customer role shell in dashboard.tsx)
- [ ] SSE upgrade for notifications when a sub-second workflow exists (see docs/NOTIFICATIONS.md)
- [ ] Generic live upload endpoint + storage (reuse src/lib/uploads.ts helper)
- [ ] VPS deployment script, PM2, DB backup automation, SSL guide
- [ ] E2E: auth flows, customers, employees

### Still deferred (2026-07-31 audit follow-ups)

- [ ] Dedicated `withAudit` unit test (entityId stringify + requestId plumbing).
- [ ] request-id test throwing-mock case (safety paths unexercised).
- [x] ~~oxfmt 0.44.0 pre-commit hook broken repo-wide~~ — resolved: removed
      `scripts/**` from `.oxfmtrc.json` ignorePatterns and formatted all scripts.

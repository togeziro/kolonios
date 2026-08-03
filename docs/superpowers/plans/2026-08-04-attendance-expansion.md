# Attendance Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing attendance module with recurring schedules, employee assignments, configurable GPS/selfie validation, individual days off, corrections, and admin reporting without changing the existing i18n or authorization model.

**Architecture:** Reuse the existing `shifts`, `locations`, and `employee_shifts` models where possible. Add focused schedule, override, correction, and policy data-access boundaries; resolve an employee's effective schedule on the server before validating attendance. Use mapcn/MapLibre for map UI, browser Geolocation and Media Capture APIs for the PWA, and keep future routing behind a provider adapter.

**Tech Stack:** TanStack Start, React 19, TanStack Router, TanStack Query, TanStack Form, Drizzle ORM, PostgreSQL, Zod, role-group permissions, mapcn, MapLibre GL JS, Vitest, Testing Library, and Playwright.

## Global Constraints

- Preserve the existing i18n model; English and Indonesian UI strings remain in locale files and must not be hardcoded.
- Use the existing `shifts` table as the master schedule definition; do not create a parallel schedule master.
- An employee has at most one check-in and one check-out per day.
- Historical attendance must retain the schedule context used when it was created.
- GPS validation is enabled by default but can be disabled by location or schedule; coordinates are still stored when available.
- When GPS validation is enabled, stale, unavailable, or inaccurate location data rejects check-in.
- Employees cannot move a map marker to forge submitted coordinates.
- The server is the authorization, validation, and persistence boundary.
- Every server function uses runtime Zod validation, `requirePermission`, shared error mapping, and React Query invalidation patterns.
- Do not add deck.gl, Valhalla, routing infrastructure, or native background location in this release.
- Do not add a framework; dependency additions are limited to `maplibre-gl`, `@types/geojson`, `xlsx`, and `pdf-lib` as specified by Tasks 4 and 7.
- Use localized, safe domain errors and the existing loading, empty, and error state standards.

---

## File Map

### Existing files to modify

- `src/lib/db/schema/attendance.ts` - extend location and attendance columns; add schedule, assignment, override, day-off, and correction tables.
- `src/lib/db/schema/index.ts` - export the attendance schema additions through the existing schema index.
- `src/lib/db/attendance.ts` - schedule resolution, policy resolution, check-in/out validation, location CRUD, correction and report queries.
- `src/features/attendance/api/types.ts` - public request, response, schedule, policy, correction, and report types.
- `src/features/attendance/api/validation.ts` - Zod schemas for all new server-function inputs.
- `src/features/attendance/api/service.ts` - authenticated server functions for schedules, locations, assignments, days off, corrections, reports, and updated attendance.
- `src/features/attendance/api/queries.ts` - query keys and query options for new admin and employee data.
- `src/features/attendance/components/attendance-check-card.tsx` - current-location, selfie, GPS status, and check-in/out UX.
- `src/features/attendance/components/attendance-history.tsx` - richer filters and daily detail fields.
- `src/features/attendance/components/leave-request-form.tsx` - attachment policy and localized validation feedback.
- `src/config/nav-config.ts` - add admin attendance navigation entries with module permissions.
- `src/i18n/locales/en/translation.json` - English attendance/admin copy.
- `src/i18n/locales/id/translation.json` - Indonesian attendance/admin copy.
- `scripts/seed.ts` - seed recurring schedule examples, policy defaults, assignments, and day-off examples.
- `src/test-utils/db.ts` - test fixtures for schedules, locations, assignments, and attendance policies.
- `src/lib/db/attendance.test.ts` - database/domain integration tests.
- `src/features/attendance/api/validation.test.ts` - input validation tests.
- `src/features/attendance/api/queries.test.ts` - query key/options tests.
- `package.json` and `bun.lock` - add the explicitly selected map/export packages in Tasks 4 and 7.

### New files to create

- `src/features/attendance/utils/schedule.ts` - pure effective-schedule, late, absence, and policy-resolution functions.
- `src/features/attendance/utils/schedule.test.ts` - unit tests for those pure functions.
- `src/features/attendance/utils/geolocation.ts` - browser location state machine and stale/accuracy checks.
- `src/features/attendance/utils/geolocation.test.ts` - deterministic browser-location tests.
- `src/features/attendance/components/location-map.tsx` - shared MapLibre/mapcn marker, accuracy, and geofence map.
- `src/features/attendance/components/location-map.test.tsx` - map interaction tests with provider mocked.
- `src/features/attendance/components/admin-location-form.tsx` - create/edit location form.
- `src/features/attendance/components/admin-schedule-form.tsx` - shift schedule and weekday policy form.
- `src/features/attendance/components/schedule-assignment-form.tsx` - individual and bulk assignment form.
- `src/features/attendance/components/day-off-form.tsx` - individual day-off form.
- `src/features/attendance/components/attendance-correction-form.tsx` - correction form requiring a reason.
- `src/features/attendance/components/admin-attendance-report.tsx` - admin filters, summary, details, and export controls.
- `src/features/attendance/components/selfie-capture.tsx` - camera capture component using browser Media Capture APIs.
- `src/routes/dashboard/admin/attendance/locations.tsx` - admin location route.
- `src/routes/dashboard/admin/attendance/schedules.tsx` - admin schedule route.
- `src/routes/dashboard/admin/attendance/assignments.tsx` - admin assignment/day-off route.
- `src/routes/dashboard/admin/attendance/reports.tsx` - admin report route.

---

### Task 1: Add schedule and attendance policy domain primitives

**Files:**
- Create: `src/features/attendance/utils/schedule.ts`
- Create: `src/features/attendance/utils/schedule.test.ts`
- Modify: `src/features/attendance/api/types.ts`
- Modify: `src/features/attendance/api/validation.ts`

**Interfaces:**
- `resolveEffectiveSchedule(input): EffectiveSchedule | null`
- `calculateLateMinutes(input): number`
- `isAbsentAfterCutoff(input): boolean`
- `resolveAttendancePolicy(input): AttendancePolicy`
- `isLocationStale(timestamp, now, maxAgeMs): boolean`
- `isAccuracyAcceptable(accuracy, maxAccuracyMeters): boolean`

- [ ] **Step 1: Write failing unit tests** for recurring weekday resolution, date override precedence, day-off precedence, zero-minute tolerance, positive tolerance, absence cutoff, GPS policy defaults, schedule-over-location policy precedence, stale timestamps, and accuracy boundaries.
- [ ] **Step 2: Run the focused test file** with `bunx vitest run src/features/attendance/utils/schedule.test.ts` and verify the new tests fail because the utilities do not exist.
- [ ] **Step 3: Implement pure utilities** with explicit numeric/date inputs so they are independent of the database, browser, timezone globals, and React.
- [ ] **Step 4: Extend shared attendance types and Zod schemas** for schedule days, assignment, override, day off, GPS policy, selfie policy, and correction reasons.
- [ ] **Step 5: Run the focused test file** and then `bun run typecheck`.
- [ ] **Step 6: Commit** with `git add src/features/attendance/utils src/features/attendance/api/types.ts src/features/attendance/api/validation.ts && git commit -m "feat: add attendance schedule domain rules"`.

### Task 2: Add database schema, migrations, fixtures, and schedule data access

**Files:**
- Modify: `src/lib/db/schema/attendance.ts`
- Modify: `src/lib/db/schema/index.ts`
- Modify: `src/lib/db/attendance.ts`
- Modify: `src/lib/db/attendance.test.ts`
- Modify: `src/test-utils/db.ts`
- Modify: `scripts/seed.ts`
- Create: one generated attendance migration SQL file in `src/lib/db/migrations/`

**Interfaces:**
- `getEffectiveEmployeeSchedule(userId, date): Promise<EffectiveSchedule | null>`
- `listScheduleAssignments(filters): Promise<ScheduleAssignmentListResponse>`
- `createScheduleAssignment(input, actorId): Promise<ScheduleAssignment>`
- `createBulkScheduleAssignment(input, actorId): Promise<BulkAssignmentResult>`
- `createScheduleOverride(input, actorId): Promise<ScheduleOverride>`
- `createDayOff(input, actorId): Promise<EmployeeDayOff>`
- `getAttendancePolicy(locationId, shiftId): Promise<AttendancePolicy>`

- [ ] **Step 1: Add schema tests/fixtures** that assert a shift can have weekday rules, employees can have one active assignment, a date can have one override/day off, and attendance can retain schedule/policy context plus GPS accuracy/timestamps and validation state.
- [ ] **Step 2: Run `bun run test:run -- src/lib/db/attendance.test.ts`** and confirm the new fixtures/tests fail before schema changes.
- [ ] **Step 3: Extend the Drizzle schema** using the existing `shifts` table as master data. Add weekday schedule rules, assignments, date overrides, day offs, policy columns, attendance context columns, and correction/audit references with appropriate foreign keys and uniqueness constraints.
- [ ] **Step 4: Implement schedule resolution and CRUD data access** in `src/lib/db/attendance.ts`, using `buildConditions`, pagination utilities, `mapDbError`, and transaction boundaries for bulk assignment.
- [ ] **Step 5: Add migration via `bun run db:generate`**, inspect the generated SQL for non-destructive constraints/defaults, and apply it with the repository's normal local migration command.
- [ ] **Step 6: Add seed and test fixtures** for one recurring schedule, one assigned employee, one day off, and one policy override without changing existing demo-account behavior.
- [ ] **Step 7: Run `bun run test:run -- src/lib/db/attendance.test.ts` and `bun run typecheck`**.
- [ ] **Step 8: Commit** schema, migration, data access, seeds, and fixtures with `git add` on only the Task 2 files and `git commit -m "feat: add attendance scheduling data model"`.

### Task 3: Expose authenticated server functions and query contracts

**Files:**
- Modify: `src/features/attendance/api/service.ts`
- Modify: `src/features/attendance/api/queries.ts`
- Modify: `src/features/attendance/api/types.ts`
- Modify: `src/features/attendance/api/validation.ts`
- Modify: `src/features/attendance/api/queries.test.ts`
- Modify: `src/features/attendance/api/validation.test.ts`
- Modify: `src/config/nav-config.ts`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- `getLocationsFn`, `createLocationFn`, `updateLocationFn`, `deleteLocationFn`
- `getSchedulesFn`, `createScheduleFn`, `updateScheduleFn`
- `getScheduleAssignmentsFn`, `assignScheduleFn`, `bulkAssignScheduleFn`
- `createScheduleOverrideFn`, `createDayOffFn`, `deleteDayOffFn`
- `requestAttendanceCorrectionFn`, `reviewAttendanceCorrectionFn`
- `getAdminAttendanceReportFn`, `exportAttendanceReportFn`

- [ ] **Step 1: Add failing validation tests** for coordinate ranges, positive radius, policy limits, weekday schedule inputs, assignment targets, date overrides, day off, correction reason, report filters, and export format.
- [ ] **Step 2: Run `bun run test:run -- src/features/attendance/api/validation.test.ts src/features/attendance/api/queries.test.ts`** and verify the new cases fail.
- [ ] **Step 3: Implement validators and response types** with exact enum values used by the schema and localized error keys rather than display strings.
- [ ] **Step 4: Implement server functions** using `withRequestContext`, `requirePermission`, rate limiting for writes, dynamic DB imports, `withAudit` for admin mutations, and shared mutation invalidation keys.
- [ ] **Step 5: Add query keys/options** for locations, schedules, assignments, effective schedule, days off, reports, and correction queues.
- [ ] **Step 6: Add admin attendance navigation** using the existing `attendance`, `employees`, and `audit_log` module permission model; do not introduce hardcoded role checks.
- [ ] **Step 7: Add both locale dictionaries** for all new labels, statuses, errors, actions, empty states, and map/GPS messages.
- [ ] **Step 8: Run focused API tests, `bun run i18n:check`, and `bun run typecheck`**.
- [ ] **Step 9: Commit** with `git add src/features/attendance/api src/config/nav-config.ts src/i18n/locales && git commit -m "feat: expose attendance management APIs"`.

### Task 4: Build admin location and schedule management

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/components/ui/map.tsx`
- Create: `src/features/attendance/components/location-map.tsx`
- Create: `src/features/attendance/components/admin-location-form.tsx`
- Create: `src/features/attendance/components/admin-schedule-form.tsx`
- Create: `src/features/attendance/components/schedule-assignment-form.tsx`
- Create: `src/features/attendance/components/day-off-form.tsx`
- Create: `src/routes/dashboard/admin/attendance/locations.tsx`
- Create: `src/routes/dashboard/admin/attendance/schedules.tsx`
- Create: `src/routes/dashboard/admin/attendance/assignments.tsx`
- Create: `src/features/attendance/components/location-map.test.tsx`

**Interfaces:**
- `LocationMapProps`: coordinates, radius, readOnly, `onChange`, optional device-location display.
- `LocationMap` emits coordinates selected by map click or marker drag; it never emits an employee-submitted check-in coordinate.
- Forms consume the Task 3 query options and mutation server functions.

- [ ] **Step 1: Add component tests** for map click updating coordinates, marker drag updating coordinates, radius circle rendering, read-only mode, and provider loading/error fallback with MapLibre mocked.
- [ ] **Step 2: Run the focused component test** and verify it fails before the map component exists.
- [ ] **Step 3: Add `maplibre-gl` and `@types/geojson` with `bun add maplibre-gl` and `bun add -d @types/geojson`; install the mapcn registry component into `src/components/ui/map.tsx`, adapt its icons to `@tabler/icons-react`, import MapLibre CSS once, and configure the tile/style URL through environment-backed configuration.
- [ ] **Step 4: Implement the shared map** with a marker, radius circle in meters, zoom-to-location behavior, keyboard-visible controls, and a non-network fallback state.
- [ ] **Step 5: Implement the location form** with name, description, status, radius, coordinate summary, GPS validation toggle, selfie requirement toggle, accuracy/staleness limits, and save validation.
- [ ] **Step 6: Implement schedule and weekday rule forms** for start/end time, late tolerance, absence cutoff, GPS/selfie policy overrides, and working/non-working days.
- [ ] **Step 7: Implement individual/bulk assignment and day-off screens** with employee/division selection, confirmation, and conflict feedback.
- [ ] **Step 8: Add route loaders, permission checks, pending/error states, and translation keys** following existing dashboard route patterns.
- [ ] **Step 9: Run `bun run test:run -- src/features/attendance/components/location-map.test.tsx`, `bun run lint`, and `bun run typecheck`**.
- [ ] **Step 10: Commit** UI and route work with `git add` on the Task 4 files and `git commit -m "feat: add attendance schedule admin UI"`.

### Task 5: Implement employee location refresh, selfie capture, and validated check-in/out

**Files:**
- Create: `src/features/attendance/utils/geolocation.ts`
- Create: `src/features/attendance/utils/geolocation.test.ts`
- Create: `src/features/attendance/components/selfie-capture.tsx`
- Modify: `src/features/attendance/components/attendance-check-card.tsx`
- Modify: `src/features/attendance/api/types.ts`
- Modify: `src/features/attendance/api/validation.ts`
- Modify: `src/lib/db/attendance.ts`
- Modify: `src/lib/db/attendance.test.ts`
- Modify: `src/features/attendance/components/attendance-page.tsx`

**Interfaces:**
- `getCurrentLocation(options): Promise<DeviceLocation>` using `navigator.geolocation.getCurrentPosition`.
- `DeviceLocation`: latitude, longitude, accuracy, capturedAt.
- `SelfieCaptureProps`: required, disabled, `onCapture`, `onClear`.
- Updated `AttendanceCheckInPayload` and `AttendanceCheckOutPayload` include coordinate accuracy, captured timestamp, selfie, and validation context.

- [ ] **Step 1: Add failing geolocation tests** for permission denied, unavailable location, stale location, inaccurate location, successful refresh, and retry behavior using mocked browser APIs.
- [ ] **Step 2: Run `bun run test:run -- src/features/attendance/utils/geolocation.test.ts`** and verify failure.
- [ ] **Step 3: Implement the location utility** with one-shot refresh semantics, explicit timeout, stale-age validation, accuracy validation, and a result that distinguishes permission, unavailable, stale, and inaccurate states.
- [ ] **Step 4: Add failing DB tests** for no active schedule, duplicate daily attendance, GPS-enabled rejection, GPS-disabled acceptance with stored coordinates, outside-radius rejection, schedule policy precedence, and selfie requirement.
- [ ] **Step 5: Update `checkIn` and `checkOut`** to resolve effective schedule/policy on the server, validate current timestamps and accuracy, calculate Haversine distance, store coordinates/accuracy/timestamps/validation state, and return localized domain error codes.
- [ ] **Step 6: Implement camera capture** with browser Media Capture APIs, explicit permission/error states, image size/type validation, and a preview/retake flow. Do not add a camera library.
- [ ] **Step 7: Update the attendance card** with `Get current location`, `Refresh location`, map preview, accuracy/radius display, selfie capture, disabled submit state, and translated rejection messages. The marker is display-only for employee location.
- [ ] **Step 8: Run focused utility/DB tests, `bun run i18n:check`, `bun run lint`, and `bun run typecheck`**.
- [ ] **Step 9: Commit** with `git add src/features/attendance src/lib/db/attendance.ts src/features/attendance/components/attendance-page.tsx && git commit -m "feat: validate attendance location and selfie"`.

### Task 6: Add attendance corrections, leave policy enforcement, and audit views

**Files:**
- Create: `src/features/attendance/components/attendance-correction-form.tsx`
- Modify: `src/lib/db/schema/attendance.ts`
- Modify: `src/lib/db/attendance.ts`
- Modify: `src/features/attendance/api/service.ts`
- Modify: `src/features/attendance/api/types.ts`
- Modify: `src/features/attendance/components/leave-request-form.tsx`
- Modify: `src/features/attendance/components/leave-history.tsx`
- Modify: `src/routes/dashboard/admin/audit-log.tsx` - add attendance entity/action filtering to the existing audit view.
- Modify: `src/lib/db/attendance.test.ts`

- [ ] **Step 1: Add failing tests** for correction reason enforcement, before/after audit payloads, permission-scoped review, attachment-required leave types, and rejection of missing required attachments.
- [ ] **Step 2: Run the focused attendance DB tests** and verify failure.
- [ ] **Step 3: Implement correction persistence and review** with transactionally updated attendance plus audit metadata containing actor, timestamp, reason, previous values, and new values.
- [ ] **Step 4: Implement leave-type attachment policy resolution** and enforce it in the server validator, not only in the form.
- [ ] **Step 5: Add correction UI** to the admin daily-detail view with editable fields limited to the approved correction surface and a required reason.
- [ ] **Step 6: Update leave UI** to show required attachment state and server errors without hardcoded copy.
- [ ] **Step 7: Run focused tests, `bun run lint`, `bun run i18n:check`, and `bun run typecheck`**.
- [ ] **Step 8: Commit** with `git add src/features/attendance src/lib/db/attendance.ts src/routes/dashboard/admin/audit-log.tsx && git commit -m "feat: add attendance corrections and leave policies"`.

### Task 7: Build admin reports and export

**Files:**
- Create: `src/features/attendance/components/admin-attendance-report.tsx`
- Create: `src/routes/dashboard/admin/attendance/reports.tsx`
- Modify: `src/lib/db/attendance.ts`
- Modify: `src/features/attendance/api/service.ts`
- Modify: `src/features/attendance/api/types.ts`
- Modify: `src/features/attendance/api/queries.ts`
- Modify: `src/features/attendance/components/attendance-history.tsx`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- `AdminAttendanceFilters`: employee, department, location, shift, status, startDate, endDate, page, limit.
- `getAdminAttendanceReportFn(filters): Promise<AdminAttendanceReportResponse>`.
- `exportAttendanceReportFn({ filters, format }): Promise<ExportResponse>`.

- [ ] **Step 1: Add failing DB tests** for employee-period summaries, daily detail fields, all selected filters, pagination, and permission-scoped report access.
- [ ] **Step 2: Run the focused DB tests** and verify failure.
- [ ] **Step 3: Implement report queries** with joins to employees, departments, shifts, locations, and effective schedule context; use shared pagination/filter utilities and stable date ordering.
- [ ] **Step 4: Implement CSV export without a new dependency**, escaping commas, quotes, line breaks, and UTF-8 values.
- [ ] **Step 5: Add `xlsx` and `pdf-lib` with `bun add xlsx pdf-lib`; implement Excel and PDF export behind `ExportService`, keeping package-specific code isolated and covering it with unit tests.
- [ ] **Step 6: Build the report screen** with period, employee, department, location, shift, status filters, summary cards, daily detail table, loading/empty/error states, and export controls.
- [ ] **Step 7: Add route loader/query prefetch** and ensure query keys preserve URL/filter state according to existing table patterns.
- [ ] **Step 8: Run report tests, `bun run lint`, `bun run i18n:check`, and `bun run typecheck`**.
- [ ] **Step 9: Commit** with `git add src/features/attendance src/routes/dashboard/admin/attendance/reports.tsx src/i18n/locales package.json bun.lock && git commit -m "feat: add attendance reports and export"`.

### Task 8: Add end-to-end coverage and perform release verification

**Files:**
- Create: `e2e/attendance-admin.spec.ts`
- Create: `e2e/attendance-employee.spec.ts`
- Modify: `e2e/helpers.ts` - add shared login, location, camera, and export mocks used by both attendance specs.
- Modify: `src/test-utils/db.ts` for deterministic E2E reset fixtures
- Modify: `docs/ATTENDANCE.md` to document the shipped scheduling, GPS, selfie, map, correction, and report behavior
- Modify: `docs/CHANGELOG.md` with the completed feature entry

- [ ] **Step 1: Add admin E2E tests** for creating a location, configuring radius/policy, creating a recurring schedule, assigning it in bulk, setting a day off, and opening the report.
- [ ] **Step 2: Add employee E2E tests** for location refresh, valid check-in, invalid/stale GPS rejection, GPS-disabled check-in with coordinates retained, selfie capture, check-out, and daily history.
- [ ] **Step 3: Add report E2E tests** for filters and each supported export format using deterministic fixtures and mocked external map/export providers where necessary.
- [ ] **Step 4: Run `bun run e2e`** and fix only feature-specific failures without weakening existing auth, permission, or browser security checks.
- [ ] **Step 5: Run the complete quality gate**: `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test:run`, `bun run build`, and `bun run e2e`.
- [ ] **Step 6: Inspect `git status`, `git diff`, and the complete commit range** for accidental locale omissions, generated secrets, unrelated changes, or untracked migration files.
- [ ] **Step 7: Commit documentation and verified E2E coverage** with `git add e2e docs/ATTENDANCE.md docs/CHANGELOG.md src/test-utils/db.ts && git commit -m "test: verify attendance expansion flows"`.

## Self-Review Checklist

- Schedule creation, weekday rules, assignment, date override, day off, and historical context are covered by Tasks 1 and 2.
- GPS enabled/disabled behavior, coordinate retention, stale/accuracy rejection, geo-fence validation, and selfie requirements are covered by Task 5.
- Admin location map and employee location refresh are covered by Tasks 4 and 5.
- Leave attachment policy and correction audit requirements are covered by Task 6.
- Employee-period summaries, daily details, filters, and export are covered by Task 7.
- Future routing is intentionally represented only as an adapter boundary in the design; no routing implementation is included in this release.
- i18n, permission enforcement, server validation, error mapping, tests, documentation, and release verification are covered across Tasks 3, 6, 7, and 8.

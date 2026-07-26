# Project Todo List

## Attendance Module (Complete ✅)

### Database Layer — Done
- [x] Schema: shifts, locations, employee_shifts, leaves, performance_reports
- [x] Masterdata schema: employees, departments, designations
- [x] Schema exports + `bun run db:push`
- [x] Seed: 2 locations, 3 shifts, 6 ISP departments, 13 ISP designations, 4 demo users, 4 employee records

### Auth & RBAC — Done
- [x] Roles: admin, hr, employee, technician
- [x] Permissions per module (attendance, leave, employee, department, designation, shift, location)
- [x] Session helpers: requireHR, requireEmployee, requireTechnician

### Backend — Done
- [x] `src/lib/db/attendance.ts` — Data access + Haversine geo-fence
- [x] Server functions: checkInFn, checkOutFn, getMyAttendanceFn, getAttendanceHistoryFn
- [x] Server functions: getMyLeavesFn, createLeaveRequestFn
- [x] Server functions: getPerformanceStatsFn, getLocationsFn, getShiftsFn
- [x] Zod validation schemas
- [x] React Query key factory + query options + mutation options

### Frontend — Done
- [x] Routes: `/dashboard/attendance`, `/dashboard/leave`
- [x] Components: AttendanceCheckCard, AttendanceHistory, LeaveRequestForm, LeaveHistory
- [x] Attendance page (check-in/out card + history table)
- [x] Leave page (request form + leave list)
- [x] Navigation shortcuts: Attendance (a,a), Leave (l,l) in Overview group

### Mobile Staff Dashboard — Done
- [x] useIsMobile hook
- [x] MobileHeader (avatar + greeting + sign-out dropdown)
- [x] MobileAttendanceSummary (circular progress + check-in/out)
- [x] InProgressTasks (horizontal scroll cards)
- [x] TaskGroups (vertical department groups with progress)
- [x] BottomNav + FAB check-in button
- [x] MobileShell layout (header + outlet + bottom nav)
- [x] StaffMobileDashboard (combines all mobile fragments)
- [x] Conditional render in dashboard.tsx + overview.tsx (role + screen size detection)

## Masterdata CRUD UI (Complete ✅)

### Departments
- [x] Route: `/dashboard/admin/departments`
- [x] Full CRUD: createDepartmentFn, updateDepartmentFn, deleteDepartmentFn
- [x] Dialog-based form + TanStack Table display

### Designations
- [x] Route: `/dashboard/admin/designations`
- [x] Full CRUD: createDesignationFn, updateDesignationFn, deleteDesignationFn
- [x] Dialog-based form with department selector + base salary
- [x] GetDesignationOptionsFn for dropdown usage

### User Form Integration
- [x] Separate "Access Level" (auth role: admin/hr/employee/technician) from "Job Title"
- [x] Job Title field populates from DB designations (AUTH_ROLE_OPTIONS const)

## Authentication (Complete ✅)

- [x] Better Auth swapped (replaces custom JWT/bcryptjs/jose)
- [x] Import fix: `better-auth/react` instead of `better-auth/client` (React hook vs Atom)
- [x] Sign-in, sign-up, sign-out, route protection
- [x] RBAC via admin plugin + createAccessControl

## Remaining / Future

### Notifications — WhatsApp integration (deferred)
- [ ] Attendance reminder system
- [ ] Late check-in notifications
- [ ] Leave approval notifications
- [ ] WhatsApp notification channel

### Masterdata — Extended (deferred)
- [ ] Customer management pages (customers, packages, routers)
- [ ] Invoice management (invoices, payments)
- [ ] Ticket support system

### Testing — Attendance/Mobile (not yet done)
- [ ] Unit tests for distance calculation (Haversine formula)
- [ ] Integration tests for attendance CRUD
- [ ] E2E tests for check-in flow
- [ ] Mobile layout responsiveness tests

### Production Deployment (deferred)
- [ ] Self-hosted VPS deployment script
- [ ] PM2 process management configuration
- [ ] Database backup automation
- [ ] SSL/HTTPS configuration guide
- [ ] CI pipeline (GitHub Actions: lint, typecheck, build, db:migrate)

## Database Layer (Completed)
- [x] PostgreSQL 17, database `tanstack_dashboard` + user `tanstack`
- [x] Drizzle ORM schema: products, users, kanban, notifications, attendance, masterdata
- [x] Better Auth schema: user, session, account, verification
- [x] Migrations applied, seed script idempotent

## Quality & Build Tooling
- [x] typecheck script (tsc --noEmit)
- [x] db:generate, db:migrate, db:push, db:seed, db:studio scripts
- [x] Pre-commit hooks: simple-git-hooks + lint-staged (oxlint, oxfmt --check, tsc)
- [x] Vitest + Testing Library stack for unit/integration tests
- [x] Playwright E2E tests (product CRUD, table sorting)
- [x] TanStack Router DevTools + React Query DevTools
- [x] Dynamic font loading per-theme
- [x] i18n: i18next + react-i18next with EN/ID locales, SSR language detection

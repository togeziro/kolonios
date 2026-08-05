# Payroll System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an auditable Payroll MVP that calculates monthly, daily, and hourly payroll for custom date periods, integrates attendance and leave deductions, supports configurable PPh 21 methods, and exposes secure payslips without calculating overtime.

**Architecture:** Add a payroll schema and data-access boundary under `src/lib/db`, a pure calculator under `src/features/payroll/utils`, validated server functions under `src/features/payroll/api`, and dashboard routes following the existing TanStack Start, React Query, TanStack Table, RBAC, and shadcn patterns. Resolve all effective-dated employee payroll data at generation time and store the inputs and outputs in an immutable calculation snapshot when the period is locked.

**Tech Stack:** Existing Bun, TanStack Start, React, React Query, TanStack Table, Drizzle ORM, PostgreSQL, Zod, Vitest, Playwright, `pdf-lib`, and existing CSV/SheetJS export tooling. No new dependency is allowed.

## Global Constraints

- Overtime is excluded from the MVP; `calculateOvertime()` returns zero and preserves a future integration boundary.
- No new framework, library, runtime, or dependency may be added without explicit user approval.
- Payroll periods use arbitrary `start_date` and `end_date`, not only calendar months.
- Salary, tax, benefit, bank, and employment records are effective-dated and must not overwrite history.
- Payroll records and payslips become immutable after the period is locked.
- Employee payroll queries are scoped to the authenticated employee; admin/HR access uses `requirePermission`.
- Expected failures use `DomainError`; database failures use `mapDbError`.
- All new UI strings must follow the existing i18n rules and be added to both locale files.
- Run focused tests after each task and `bun run typecheck`, `bun run lint`, `bun run test:run`, and `bun run build` before completion.

---

## File Map

**Create:**

- `src/lib/db/schema/payroll.ts` - Payroll tables, enums, relations, and inferred types.
- `src/lib/db/payroll.ts` - Server-only payroll data access and effective-date queries.
- `src/features/payroll/api/types.ts` - Public payroll payload, filter, and response types.
- `src/features/payroll/api/validation.ts` - Zod schemas for all payroll mutations and filters.
- `src/features/payroll/api/service.ts` - Authenticated server functions.
- `src/features/payroll/api/queries.ts` - Query keys and React Query options.
- `src/features/payroll/api/mutations.ts` - Mutations and cache invalidation.
- `src/features/payroll/utils/calculator.ts` - Pure salary, deduction, and tax calculations.
- `src/features/payroll/utils/calculator.test.ts` - Pure calculator tests.
- `src/lib/db/payroll.test.ts` - Payroll data-access and workflow tests.
- `src/routes/dashboard/admin/payroll/index.tsx` - Admin payroll overview.
- `src/routes/dashboard/admin/payroll/components.tsx` - Salary component configuration.
- `src/routes/dashboard/admin/payroll/profile.tsx` - Employee payroll profile management.
- `src/routes/dashboard/admin/payroll/periods.tsx` - Payroll period management.
- `src/routes/dashboard/admin/payroll/generate.tsx` - Generate and review payroll.
- `src/routes/dashboard/admin/payroll/records.tsx` - Ready-to-pay and paid records.
- `src/routes/dashboard/admin/payroll/reports.tsx` - Summary and export reports.
- `src/routes/dashboard/payroll/payslips.tsx` - Employee self-service payslips.

**Modify:**

- `src/lib/db/schema/index.ts` - Export payroll schema.
- `src/features/role-groups/api/types.ts` or the existing permission definition - Add payroll permission keys without changing unrelated permissions.
- Existing dashboard navigation files - Add payroll navigation filtered through role-group permissions.
- Existing locale files - Add payroll UI strings in English and Indonesian.
- Drizzle migration output under `drizzle/` - Create the versioned schema migration using the repository's migration workflow.

---

### Task 1: Add Payroll Schema and Migration

**Files:**
- Create: `src/lib/db/schema/payroll.ts`
- Modify: `src/lib/db/schema/index.ts`
- Create: generated migration under `drizzle/`
- Test: `src/lib/db/payroll.test.ts`

**Interfaces:**
- Consumes: `employees.id`, `user.id`, `departments.id`, `designations.id`, existing schema export conventions.
- Produces: `salaryComponents`, `employeeSalaryAssignments`, `employeeSalaryComponents`, `payrollPeriods`, `payrollRecords`, `payslips`, `taxSettings`, `employeeTaxProfiles`, `employeeTaxRecords`, `employeeBenefitEnrollments`, `employeeBankAccounts`, `employeeEmploymentEvents`, and `employeeDocuments`.

- [ ] **Step 1: Write schema contract tests** for required table exports, enum values, unique `(payroll_period_id, employee_id)`, effective-date fields, and foreign-key delete behavior.
- [ ] **Step 2: Run the focused test** with `bun run test:run src/lib/db/payroll.test.ts`; verify the new exports fail before implementation.
- [ ] **Step 3: Implement `payroll.ts`** using existing `pgTable`, `pgEnum`, `jsonb`, `numeric`/`real`, `timestamp`, `date` conventions. Use employee IDs as `text`, not serial IDs, because `employees.id` mirrors `user.id`.
- [ ] **Step 4: Define status enums** for `draft`, `processing`, `ready_to_pay`, `paid`, and `locked`; define salary type `monthly`, `daily`, `hourly`; define component type `allowance`, `deduction`.
- [ ] **Step 5: Add effective-date uniqueness and indexes** for employee/date lookups, payroll period status, employee tax records, and primary bank-account queries. Enforce one primary account per employee at the application boundary and add the strongest compatible database constraint.
- [ ] **Step 6: Export the schema and inferred types** from `src/lib/db/schema/index.ts` following the existing export style.
- [ ] **Step 7: Generate the migration** with `bun run db:generate`; inspect it to ensure it contains only Payroll tables and indexes.
- [ ] **Step 8: Run the focused schema test and typecheck** with `bun run test:run src/lib/db/payroll.test.ts` and `bun run typecheck`.
- [ ] **Step 9: Commit** with `git add src/lib/db/schema src/lib/db/payroll.test.ts drizzle && git commit -m "feat: add payroll schema"`.

### Task 2: Implement Effective-Dated Data Access

**Files:**
- Create: `src/lib/db/payroll.ts`
- Modify: `src/lib/db/payroll.test.ts`

**Interfaces:**
- Consumes: Payroll schema from Task 1 and existing `db`, `mapDbError`, and pagination/sorting utilities.
- Produces: `getEffectiveSalaryAssignment(employeeId, periodStart, periodEnd)`, `getEffectiveSalaryComponents(...)`, `getEffectiveTaxProfile(...)`, `getEffectiveBenefits(...)`, `getPrimaryBankAccount(...)`, `getEmploymentContext(...)`, and CRUD functions for components, profiles, periods, and records.

- [ ] **Step 1: Write failing tests** for selecting the latest record whose effective range covers a payroll date, rejecting overlapping active assignments, and excluding records outside the payroll period.
- [ ] **Step 2: Run `bun run test:run src/lib/db/payroll.test.ts`** and confirm the effective-date tests fail.
- [ ] **Step 3: Implement one shared date-resolution helper** that accepts `employeeId`, `asOfDate`, and an ordered query result, returning the active record or `null`; keep date comparison in SQL for list queries and use the helper for deterministic tie-breaking.
- [ ] **Step 4: Implement salary, component, tax, benefit, bank, and employment-event reads** with explicit period/date parameters. Never fall back to the mutable `employees.base_salary` when an effective salary assignment is required; return a domain error when required payroll data is missing.
- [ ] **Step 5: Implement salary component and employee profile mutations** with Zod-compatible payload types, effective-date overlap checks, and `updated_at` updates.
- [ ] **Step 6: Implement period and record reads** with filters for period, department, employee, and status; ensure employee-facing reads require an employee ID filter.
- [ ] **Step 7: Implement workflow mutations** for generation, approval/`ready_to_pay`, payment/`paid`, and locking. Reject edits, recalculation, or payment transitions that violate the state machine.
- [ ] **Step 8: Add tests** for missing salary data, invalid date ranges, locked-period mutation rejection, duplicate records, and employee scope isolation.
- [ ] **Step 9: Run `bun run test:run src/lib/db/payroll.test.ts` and `bun run typecheck`**.
- [ ] **Step 10: Commit** with `git add src/lib/db/payroll.ts src/lib/db/payroll.test.ts && git commit -m "feat: add payroll data access"`.

### Task 3: Build the Pure Calculation Engine

**Files:**
- Create: `src/features/payroll/utils/calculator.ts`
- Create: `src/features/payroll/utils/calculator.test.ts`
- Create: `src/features/payroll/api/types.ts`

**Interfaces:**
- Consumes: resolved salary profile, salary components, attendance totals, approved leave totals, tax profile, tax settings, and manual adjustments.
- Produces: `calculatePayroll(input): PayrollCalculationResult`, with gross salary, allowance total, deduction total, attendance deductions, tax, net salary, overtime zero, line items, and a serializable snapshot.

- [ ] **Step 1: Define input and output types** with integer money values or the repository's established numeric representation; document rounding at each boundary and use one consistent rounding rule.
- [ ] **Step 2: Write failing tests** for monthly, daily, and hourly salary calculations; fixed, percentage, and per-attendance components; absent, late, and unpaid-leave deductions; manual bonus/deduction adjustments; zero overtime; and net-pay calculation.
- [ ] **Step 3: Run `bun run test:run src/features/payroll/utils/calculator.test.ts`** and verify failures.
- [ ] **Step 4: Implement `calculateBaseSalary()`** using the salary type and attendance/working-hour inputs. Monthly salary is prorated only when the configured attendance deduction policy requires it; daily and hourly salary use payable attendance/hours.
- [ ] **Step 5: Implement `calculateAllowances()` and `calculateDeductions()`** for fixed, percentage, per-attendance, and manual line items, preserving item names and taxability in the result.
- [ ] **Step 6: Implement `calculateAttendanceDeductions()`** with explicit settings: absence enabled, late mode `none`/`fixed`/`partial`, late amount or rate, and unpaid-leave enabled.
- [ ] **Step 7: Implement tax strategy dispatch** with `calculateProgressiveTax()` and `calculateTerTax()` behind a single `calculateTax()` function. Store method, taxable income, PTKP, bracket/category, and final tax in the result.
- [ ] **Step 8: Implement `calculateOvertime()`** as a pure function returning `{ hours: 0, amount: 0, source: 'mvp-disabled' }` and make the main calculation call it so the future Overtime module has a stable seam.
- [ ] **Step 9: Run focused tests until all calculation cases pass**, then run `bun run typecheck`.
- [ ] **Step 10: Commit** with `git add src/features/payroll/utils src/features/payroll/api/types.ts && git commit -m "feat: add payroll calculator"`.

### Task 4: Add Validated Server Functions and Client Data Hooks

**Files:**
- Create: `src/features/payroll/api/validation.ts`
- Create: `src/features/payroll/api/service.ts`
- Create: `src/features/payroll/api/queries.ts`
- Create: `src/features/payroll/api/mutations.ts`
- Modify: existing permission definitions and role-group seed/default permissions
- Modify: locale files for payroll labels and errors
- Test: `src/lib/db/payroll.test.ts` and service tests alongside the existing feature test conventions

**Interfaces:**
- Consumes: Task 2 data access and Task 3 `calculatePayroll`.
- Produces: `listSalaryComponentsFn`, `createSalaryComponentFn`, `updateSalaryComponentFn`, `deleteSalaryComponentFn`, `getEmployeePayrollProfileFn`, `updateEmployeePayrollProfileFn`, `createPayrollPeriodFn`, `listPayrollPeriodsFn`, `generatePayrollFn`, `listPayrollRecordsFn`, `approvePayrollFn`, `markPayrollPaidFn`, `lockPayrollFn`, `getMyPayslipsFn`, and `getPayrollReportFn`.

- [ ] **Step 1: Define Zod schemas** for money values, date ranges, salary types, component types, tax profiles, benefit enrollment, bank accounts, manual adjustments, filters, and workflow transitions.
- [ ] **Step 2: Add permission keys** `payroll.view`, `payroll.add`, `payroll.edit`, `payroll.delete`, `payroll.approve`, `payroll.pay`, and `payroll.reports` using the existing permission shape. Grant full access to administrator, operational access to HR, and own-payslip access to employees.
- [ ] **Step 3: Write failing service tests** for unauthenticated access, missing permission, employee scope isolation, invalid period, generation, approval, payment, and lock transitions.
- [ ] **Step 4: Implement server functions** with `requireSession`/`requirePermission`, Zod parsing, `checkRateLimit` for generation/payment mutations, and `mapDbError` at the data boundary.
- [ ] **Step 5: Implement `generatePayrollFn`** as a transaction or equivalent protected workflow: resolve active employees, fetch effective records, aggregate attendance/leave, calculate each result, save line items and snapshot, and prevent duplicate period/employee records.
- [ ] **Step 6: Implement React Query keys and options** for components, employee payroll profile, periods, records, reports, and own payslips; mutations invalidate only the affected payroll keys.
- [ ] **Step 7: Add all new UI copy** to both locale files and run `bun run i18n:check`.
- [ ] **Step 8: Run service tests, `bun run typecheck`, and `bun run lint`**.
- [ ] **Step 9: Commit** with `git add src/features/payroll src/lib/db/payroll.test.ts src/i18n src/hooks src/lib/db/role-groups.ts && git commit -m "feat: add payroll server API"`.

### Task 5: Implement Admin Payroll UI

**Files:**
- Create: `src/routes/dashboard/admin/payroll/index.tsx`
- Create: `src/routes/dashboard/admin/payroll/components.tsx`
- Create: `src/routes/dashboard/admin/payroll/profile.tsx`
- Create: `src/routes/dashboard/admin/payroll/periods.tsx`
- Create: `src/routes/dashboard/admin/payroll/generate.tsx`
- Create: `src/routes/dashboard/admin/payroll/records.tsx`
- Create: `src/routes/dashboard/admin/payroll/reports.tsx`
- Modify: dashboard navigation and route permission filtering
- Create/modify: focused component tests using existing UI test conventions

**Interfaces:**
- Consumes: Task 4 server functions, query options, mutations, permission keys, and locale keys.
- Produces: Admin flow from salary configuration through calculation, review, ready-to-pay, paid, and locked states.

- [ ] **Step 1: Add route shells** with existing `PageContainer`, loading, error, and permission guard patterns.
- [ ] **Step 2: Build salary component table and dialog** with allowance/deduction, fixed/percentage/per-attendance mode, taxable flag, active status, validation, and delete safeguards.
- [ ] **Step 3: Build employee payroll profile UI** with effective-dated salary assignment, components, PPh 21 profile, BPJS enrollment, and bank account history; mask account numbers except the final four digits.
- [ ] **Step 4: Build payroll period table and form** with custom start/end dates, payment date, validation that end is not before start, and workflow status badges.
- [ ] **Step 5: Build generate/review UI** with period selection, employee count, calculation preview, missing-data errors, and a generate action with progress/loading state.
- [ ] **Step 6: Build records UI** with TanStack Table, period/department/status filters, detail breakdown, manual adjustments before approval, and actions for ready-to-pay, paid, and lock transitions.
- [ ] **Step 7: Build reports UI** for department totals, allowance/deduction totals, tax totals, and existing CSV/XLSX export mechanisms without adding a package.
- [ ] **Step 8: Add mobile-safe horizontal table wrappers** and pin action columns using the repository's TanStack Table conventions.
- [ ] **Step 9: Run `bun run typecheck`, `bun run lint`, and focused component tests**.
- [ ] **Step 10: Commit** with `git add src/routes/dashboard/admin/payroll src/components src/hooks src/i18n && git commit -m "feat: add payroll admin screens"`.

### Task 6: Implement Payslip and Employee Self-Service

**Files:**
- Create: `src/features/payroll/components/payslip-template.tsx`
- Create: `src/features/payroll/components/payslip-download.tsx`
- Create: `src/routes/dashboard/payroll/payslips.tsx`
- Modify: employee navigation and mobile shell navigation where appropriate
- Test: `src/features/payroll/components/payslip-template.test.tsx`

**Interfaces:**
- Consumes: locked `payroll_records`, `payslips`, employee identity, company information, and `getMyPayslipsFn`.
- Produces: HTML preview and PDF download for an employee's own paid payslip.

- [ ] **Step 1: Write failing rendering tests** for company header, employee identity, period, earnings, deductions, tax, net pay, and masked bank account.
- [ ] **Step 2: Implement the payslip template** from the stored snapshot and line items, not from current mutable employee salary data.
- [ ] **Step 3: Implement PDF generation** with the existing `pdf-lib` dependency and a deterministic filename containing employee code and payroll period.
- [ ] **Step 4: Implement the employee payslip table** with paid/locked records only, period filter, empty state, error state, and download action.
- [ ] **Step 5: Verify server-side employee scoping** with a test that employee A cannot fetch employee B's record by changing an ID or query filter.
- [ ] **Step 6: Run `bun run test:run src/features/payroll/components/payslip-template.test.tsx` and `bun run typecheck`**.
- [ ] **Step 7: Commit** with `git add src/features/payroll/components src/routes/dashboard/payroll && git commit -m "feat: add employee payslips"`.

### Task 7: Seed, Audit, and End-to-End Verification

**Files:**
- Modify: `scripts/seed.ts`
- Modify: existing audit-log integration points
- Create: `e2e/payroll.spec.ts`
- Modify: `docs/PAYROLL_WORK_PLAN.md` locally if implementation status is recorded

**Interfaces:**
- Consumes: all Tasks 1-6.
- Produces: reproducible demo payroll data and a complete tested admin-to-employee flow.

- [ ] **Step 1: Add seed data** for salary components, one effective salary assignment per demo employee, tax profiles, BPJS records, primary bank accounts, and a custom payroll period fixture without real personal data.
- [ ] **Step 2: Add audit events** for generation, manual adjustment, approval, payment, and lock transitions; ensure audit entries do not contain full account numbers or tax identifiers.
- [ ] **Step 3: Write the Playwright flow**: administrator creates/uses a period, generates payroll, reviews a record, marks ready-to-pay, records payment, locks the period, and employee views/downloads only their own payslip.
- [ ] **Step 4: Run the focused browser flow** with `bun run e2e e2e/payroll.spec.ts` against the test database and existing auth setup.
- [ ] **Step 5: Run the full verification suite** with `bun run typecheck`, `bun run lint`, `bun run test:run`, and `bun run build`.
- [ ] **Step 6: Review `git diff`, `git status`, migration contents, and dependency changes**; confirm no package or lockfile changes were introduced.
- [ ] **Step 7: Commit** with `git add scripts/seed.ts e2e/payroll.spec.ts src/lib/db src/features/payroll src/routes/dashboard && git commit -m "test: verify payroll workflow"`.

## Definition of Done

- Payroll works for custom periods and monthly/daily/hourly salary types.
- Attendance, late, unpaid-leave, manual adjustments, and configurable tax methods are covered by unit tests.
- Overtime is explicitly zero and not silently inferred from unrelated attendance data.
- Effective-dated employee payroll data is resolved correctly and preserved in snapshots.
- Payroll transitions are authorized, audited, and immutable after lock.
- Employees can access only their own paid payslips.
- No new dependencies, frameworks, or stack components were added.
- Typecheck, lint, unit tests, E2E test, and production build pass.

# Task 4 Report

## Implemented

- Added Zod validation for payroll money, dates, components, profiles, periods, record filters, generation, reports, and payslips.
- Added all requested payroll server functions with session/permission checks, employee self-scope enforcement, rate limits for generation and payment, audit events, and delegated state-transition enforcement.
- Added payroll generation orchestration using active employees, effective salary/tax records, attendance and approved leave totals, calculator minor-unit conversion, tax JSON mapping, snapshots, and transactional duplicate protection from Task 2.
- Added React Query keys/options and mutation hooks with payroll-key invalidation.
- Added payroll permission actions and seeded administrator, HR, employee, and technician access defaults.
- Added English and Indonesian payroll locale strings.
- Added focused validation, query, and service boundary tests.

## Verification

- `bun run test:run src/features/payroll/api src/lib/db/payroll.test.ts`: passed, 4 files / 25 tests.
- `bun run typecheck`: passed.
- `bun run i18n:check`: passed.
- Targeted `oxlint` for Task 4 files: passed.
- `bun run lint`: blocked by pre-existing `src/components/layout/mobile-header.tsx:53` accessibility error (`control-has-associated-label`); remaining output is existing warnings.

## Concerns

- Task 2 schema does not persist component calculation modes or a dedicated attendance-hours aggregate, so generation treats effective salary components as fixed amounts and derives worked hours from completed attendance rows at eight hours per row.
- Payroll profile updates and reports are implemented in the Task 4 service layer; the Task 2 schema remains the persistence contract.
- Payroll reports remain record-based, with CSV output available when requested.

## Review Fixes

- `listPayrollRecordsFn` now derives scope from the authenticated role and forces staff to their own employee ID; client scope and employee filters cannot widen access.
- Added `withPayrollAuditTransaction`; payroll component, period, profile, generation, and workflow mutations now insert audit rows in the same transaction so audit failure rolls back data.
- Generation now locks the period before reading active employees, effective payroll data, schedule/calendar, attendance, and leave, then calculates and writes inside the same transaction.
- Tax JSON mapping now validates method, PTKP, progressive bounds/rates, TER categories/bounds/rates, and converts persisted money decimals to calculator minor units.
- Replaced arbitrary profile records with discriminated assignment, component, tax, benefit, and bank schemas; all five update/insert paths are implemented.
- Attendance totals now use effective schedule/calendar days, exclude pending attendance, clip approved leave to the period, and preserve zero scheduled days.
- React Query mutations invalidate only affected payroll query families; added `useUpdateEmployeePayrollProfile`.
- Payroll role permissions now expose configurable `approve`, `pay`, and `reports` actions in the module registry and UI.
- CSV reports now produce escaped CSV output; unsupported formats are rejected by validation. Removed duplicate profile validation.
- Added regression coverage for scope bypass, audit rollback, tax mapping, validation, period clipping, pending attendance, invalidation, profile permissions/hooks, role actions, and CSV output.

## Review-Fix Verification

- `bun run test:run src/features/payroll src/lib/db/payroll.test.ts src/features/role-groups/modules.test.ts`: passed, 6 files / 53 tests.
- `bun run typecheck`: passed.
- `bun run i18n:check`: passed, 638 keys in both locales.
- `bun x oxlint src/features/payroll src/features/role-groups/modules.ts src/features/role-groups/modules.test.ts src/features/role-groups/components/role-permissions-page.tsx src/lib/db/payroll.ts src/lib/db/payroll.test.ts`: passed with warnings only.
- Full `bun run lint`: remains blocked by the pre-existing `src/components/layout/mobile-header.tsx:53` `control-has-associated-label` error.

## Updated Concerns

- Task 2 stores no component calculation mode, so payroll generation still treats persisted employee salary components as fixed amounts.
- Worked hours remain derived from attendance check-in/check-out timestamps; no persisted shift-duration aggregate exists.

## Final Review Fixes

- Changed single-family `payrollMutationKeys` helpers to return the registered query-key tuples directly, removing the extra wrapper array; regression tests now compare the exact registered key shape.
- Added `assertProfileReferenceScope` and enforced assignment ownership plus salary-component definition/existing-row ownership checks before component profile inserts and updates. Staff payroll editors cannot use another employee's assignment/component IDs.

## Final Verification

- `bun run test:run src/features/payroll/api/queries.test.ts src/features/payroll/api/service.test.ts`: passed, 2 files / 10 tests during focused red/green verification.
- `bun run test:run src/features/payroll src/lib/db/payroll.test.ts src/features/role-groups/modules.test.ts`: passed, 6 files / 54 tests.
- `bun run typecheck`: passed.
- `bun x oxlint src/features/payroll src/features/role-groups/modules.ts src/features/role-groups/modules.test.ts src/features/role-groups/components/role-permissions-page.tsx src/lib/db/payroll.ts src/lib/db/payroll.test.ts`: passed with warnings only.

# Task 6 Report: Payslip and Employee Self-Service

## Implemented

- Added `PayslipTemplate` for snapshot-backed HTML payslips with company header, employee identity, payroll period, line items, earnings, deductions, tax, net pay, and masked bank account display.
- Added `payslipFromRecord` to map persisted payroll record snapshots and joined employee/period fields without reading mutable current salary data.
- Added `createPayslipPdf` using the existing `pdf-lib` dependency. Files use the deterministic `payslip-<employee-code>-<YYYY-MM>.pdf` filename format.
- Added `PayslipDownload` and `downloadPayslip` with loading/error handling and browser download behavior.
- Added `/dashboard/payroll/payslips` with period filtering, paid/locked-only records, employee-scoped server data, loading/error/empty states, preview, and download actions.
- Updated desktop and mobile navigation plus English and Indonesian translations.
- Tightened `getMyPayslipsFn` to force the authenticated employee scope and paid/locked period statuses, return stored period/employee/payslip metadata, and return only masked bank account values.

## Tests

- `src/features/payroll/components/payslip-template.test.tsx`: rendering, snapshot values, masking, PDF signature, and deterministic filename.
- `src/features/payroll/components/payslip-download.test.ts`: browser download filename and URL lifecycle.
- Existing payroll service scope tests verify staff cannot change the employee ID/query filter to read another employee.

## Verification

- `bun run test:run src/features/payroll/components/payslip-template.test.tsx`: passed.
- Focused payroll test set: 4 files, 17 tests passed.
- `bun run typecheck`: passed.
- `bun run i18n:check`: passed with 742 keys in both locales.
- Targeted `oxlint`: passed with only pre-existing warnings in touched legacy payroll/database files.
- `bun run build`: passed; route generation included the new payslip route.

## Concerns

- The repository-wide hardcoded-string check remains red because of pre-existing violations in payroll admin, role-group, and masterdata files. The new payslip template was cleaned up and adds no new violation.
- The current schema does not create payslip rows during payroll payment; the employee view supports the existing optional payslip metadata and remains usable from locked/paid payroll records.

## Review Fixes (2026-08-05)

- Reworked PDF generation to wrap every line by measured font width, paginate at fixed page bounds, repeat no unsafe overflow, and replace glyphs unsupported by the existing PDF standard font with a safe placeholder instead of throwing. The PDF now includes the same company address, employee code/name/department/designation, period, line items, totals, tax, net pay, and masked bank details as the HTML view.
- Added typed `CompanyProfile` delivery from `getMyPayslipsFn`. It reads optional `COMPANY_NAME` and `COMPANY_ADDRESS` server configuration and explicitly falls back to `Kolonios` when unset; the client no longer chooses company identity. Added the variables to `env.example.txt`.
- Passed translated labels into PDF generation from the existing i18n keys.
- Added mobile bottom-navigation filtering for `payroll.view`, matching the desktop permission behavior while retaining the route's server-side authorization.
- Added `listMyPayslips` as the scoped database query path and an integration test proving employee A receives no employee B record. The test database was recreated with `bun run db:test:create` before verification because it was stale.
- Sanitized employee-code and period filename components using normalized ASCII-safe segments with bounded length and fallbacks.
- Delayed PDF object URL revocation by 1000ms and updated the browser download integration test to assert delayed cleanup.
- Added tests for long Unicode line items, multi-page output, configured company identity, filename sanitization, mobile permissions, and delayed URL revocation.

## Review Verification

- `bun run db:test:create`: passed; recreated `kolonios_test` and applied the current schema.
- `bun run test:run src/features/payroll/components/payslip-template.test.tsx src/features/payroll/components/payslip-download.test.ts src/components/layout/bottom-nav.test.ts src/features/payroll/api/service.test.ts src/lib/db/payroll.test.ts`: passed, 5 files / 38 tests.
- `bun run typecheck`: passed.
- `bun run i18n:check`: passed with 742 keys in both locales.
- Targeted `oxlint`: completed with pre-existing `no-explicit-any` and `consistent-function-scoping` warnings only.
- `bun run build`: passed; generated the payslip route and production bundles.
- `bun run i18n:hardcoded`: remains red only for pre-existing violations in payroll admin, role-group, and masterdata files; no new payslip violation was reported.

## Remaining Task 6 Review Fix (2026-08-05)

### Changes

- Added `src/features/payroll/api/service.integration.test.ts` covering an authenticated employee A request that attempts an employee B ID/query and asserting only employee A's paid payslip is returned, with processing-period and employee B rows excluded.
- Reused the existing `requirePermission` authentication mocks and test database helpers; production scope logic was not changed.
- The test invokes the service handler path used by `getMyPayslipsFn`. TanStack Start transforms direct server-function calls into an SSR RPC stub under Vitest, so the test exercises the authenticated handler implementation rather than bypassing authorization or changing production behavior.

### Verification

- `bun run test:run src/features/payroll/api/service.integration.test.ts`: passed, 1 test.
- `bun run test:run src/features/payroll/api/service.integration.test.ts src/features/payroll/api/service.test.ts src/features/payroll/components/payslip-template.test.tsx src/features/payroll/components/payslip-download.test.ts src/lib/db/payroll.test.ts`: passed, 5 files / 38 tests. Existing payroll rollback test logs an expected foreign-key error while testing rollback handling.
- `bun run typecheck`: passed.
- `bun run build`: passed; generated the payslip route and production bundles.

## Task 6 Test Boundary Correction (2026-08-05)

### Exact Changes

- Replaced the local `getMyPayslipsFn` wrapper in `src/features/payroll/api/service.integration.test.ts` with an import of the production `getMyPayslipsFn` from `./service`.
- Added a provider RPC test adapter that bridges that exported caller to the production `getMyPayslipsFn_createServerFn_handler` from the TanStack Start `tss-serverfn-split` provider module, so the extracted validator and authenticated handler execute under Vitest; no production code, dependency, or authentication bypass changed.
- Kept the employee A session while submitting employee B's `employeeId` filter and added employee A `locked`, employee A `processing`, and employee B `paid` fixtures.
- Asserted exactly employee A's `paid` and `locked` rows are returned, with employee B and `processing` rows excluded, and retained session/header/permission assertions.

### Exact Verification Outputs

- `bun run test:run src/features/payroll/api/service.integration.test.ts`: passed; `Test Files 1 passed (1)`, `Tests 1 passed (1)`.
- `bun run test:run src/features/payroll/api/service.integration.test.ts src/features/payroll/api/service.test.ts`: passed; `Test Files 2 passed (2)`, `Tests 11 passed (11)`.
- `bun run typecheck`: passed; `tsc --noEmit` exited 0.
- `bun run build`: passed; Vite and Nitro completed, `Generated .output/nitro.json`, and exited 0.
- Focused test and build output included the existing route-file warnings for non-Route payroll component/test files; the build also emitted existing dependency `use client` directive warnings.

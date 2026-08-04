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

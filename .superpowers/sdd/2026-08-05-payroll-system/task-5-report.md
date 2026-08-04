# Task 5 Report: Admin Payroll UI

## Implementation

- Added payroll overview and salary component management at `src/routes/dashboard/admin/payroll/index.tsx` and `components.tsx`.
- Added effective-dated employee payroll profile editing and masked bank-account display in `profile.tsx`.
- Added custom payroll period creation with start/end validation and workflow badges in `periods.tsx`.
- Added draft-period payroll generation with loading state and server error display in `generate.tsx`.
- Added payroll record filtering and workflow actions for ready-to-pay, paid, and locked transitions in `records.tsx`.
- Added payroll report totals and CSV export through the existing report server function in `reports.tsx`.
- Added payroll navigation, permission guards, and English/Indonesian locale keys.
- Added focused helper tests for bank masking and payroll money formatting.

## API Constraints

- The existing salary-component API supports code, name, allowance/deduction type, description, and active status. The UI does not invent unsupported mode, taxable, or amount fields.
- The payroll report API now supports JSON, CSV, and XLSX through the repository's existing `xlsx` export adapter.
- A smallest-scope, server-authorized manual-adjustment mutation was added and is restricted to `processing` periods.

## Verification

- `bun test src/routes/dashboard/admin/payroll/components.test.tsx`: passed, 2 tests.
- `bun run typecheck`: passed.
- `bun run i18n:check`: passed, English/Indonesian parity confirmed.
- Targeted `bunx oxlint src/routes/dashboard/admin/payroll src/config/nav-config.ts src/components/layout/app-sidebar.tsx`: warnings only, primarily existing-style `any` usage in the new compact route components.
- Full `bun run lint`: blocked by pre-existing `jsx-a11y/control-has-associated-label` error in `src/components/layout/mobile-header.tsx`; repository also reports existing warnings outside this task.

## Concerns

- Existing database/service code still emits unrelated `any` warnings; touched payroll route and component files are clean under targeted lint.

## Review Fixes

- Replaced the records table with the shared TanStack `DataTable`, server-backed period/department/status filters, pinned actions, detail breakdown dialog, explicit loading/error/empty states, guarded workflow actions, and a validated pre-approval adjustment mutation.
- Added `payment_date` to the payroll-period schema, validation, create payload, migration `0012_nebulous_morlocks.sql`, table display, and generation preview.
- Added profile-history reads for salary assignments/components, PPh 21 profiles, BPJS benefits, and bank accounts; the profile screen edits each effective-dated section and masks bank numbers except the final four digits.
- Added client permission checks for component CRUD, period creation, profile edits, generation, adjustments, approval, payment, locking, and exports while retaining server permission guards.
- Added complete server-side report aggregation by department, tax, and allowance/deduction component, plus CSV and existing-tool XLSX export.
- Added generation employee count, period/employee loading and error states, missing-data feedback, profile navigation, permission tests, workflow-column tests, validation tests, adjustment tests, and table helper tests.

## Review Verification

- `bun run db:generate`: passed; generated `0012_nebulous_morlocks.sql`, then hardened it to backfill existing rows from `period_end` before `NOT NULL`.
- `bun test src/features/payroll/api/validation.test.ts src/features/payroll/api/service.test.ts src/features/payroll/api/queries.test.ts src/features/payroll/components/permissions.test.ts src/routes/dashboard/admin/payroll/components.test.tsx src/routes/dashboard/admin/payroll/records-columns.test.tsx`: passed, 24 tests, 42 assertions.
- `bun run typecheck`: passed.
- `bun run i18n:check`: passed, 733 keys in both locales.
- Targeted `bunx oxlint src/routes/dashboard/admin/payroll src/features/payroll/components src/features/payroll/api src/lib/db/schema/payroll.ts src/lib/db/payroll.ts src/config/nav-config.ts src/components/layout/app-sidebar.tsx`: warnings only from pre-existing database/service `any` and CSV helper patterns; touched route files have no targeted lint errors.
- Full `bun run lint`: retains the known unrelated `jsx-a11y/control-has-associated-label` error in `src/components/layout/mobile-header.tsx`.

## Final Command Evidence

- `bun run typecheck`: `$ tsc --noEmit` completed successfully.
- Focused payroll test command: `24 pass`, `0 fail`, `42 expect() calls`.
- `bun run i18n:check`: `i18n key parity OK (733 keys in both locales)`.
- Targeted `bunx oxlint src/routes/dashboard/admin/payroll src/features/payroll/components`: completed with no output and no findings.
- Full `bun run lint`: completed lint output with existing warnings, then exited `1` on `src/components/layout/mobile-header.tsx:53:9` (`jsx-a11y/control-has-associated-label`).

## Updated Concerns

- Payroll detail line-item component amounts remain in calculator minor units in the aggregate payload, matching the existing calculator snapshot contract.

## Final Review Fixes

- Added explicit `encoding` metadata: CSV responses are `identity` text, while XLSX responses remain `base64`; the client now decodes only binary formats and preserves CSV text bytes.
- Normalized report aggregation to persisted display units by dividing calculator minor-unit tax and allowance/deduction line items exactly once, while excluding `base` and `tax` line items from component totals.
- Added add-record paths for components, PPh 21, BPJS benefits, and bank accounts even when existing history is non-empty; new records omit identity IDs and continue through the existing effective-date and server overlap validation.
- Added regressions for CSV/binary decoding, report filtering and unit normalization, and new profile-record identity behavior.

## Final Review Command Evidence

- `bun test src/features/payroll/api/validation.test.ts src/features/payroll/api/service.test.ts src/features/payroll/api/queries.test.ts src/features/payroll/components/permissions.test.ts src/routes/dashboard/admin/payroll/components.test.tsx src/routes/dashboard/admin/payroll/records-columns.test.tsx src/routes/dashboard/admin/payroll/reports-download.test.ts src/routes/dashboard/admin/payroll/profile.test.ts`: `27 pass`, `0 fail`, `51 expect() calls`.
- `bun run typecheck`: `$ tsc --noEmit` completed successfully.
- `bun run i18n:check`: `i18n key parity OK (733 keys in both locales)`.
- `bunx oxlint src/routes/dashboard/admin/payroll src/features/payroll/components`: completed with no output and no findings.

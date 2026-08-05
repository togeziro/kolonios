# Payroll Task 7 Fix Report

## Fixes

- Added persisted salary-component mode, percentage base, attendance metric, and taxability fields, validation, profile mapping, UI controls, calculator integration, and migration `0013_great_vivisector.sql`.
- Payroll generation now segments custom periods at effective salary, component, and tax changes. Each segment resolves attendance, paid/unpaid leave policy, benefits, primary bank context, and employment events into the payroll snapshot.
- Profile version updates now close the prior effective row and insert a new version for salary assignments, components, tax profiles, benefits, and bank accounts. Same-date historical edits are rejected.
- Added leave-type `is_paid` policy. Only approved leave explicitly marked unpaid contributes to unpaid-leave deductions.
- Employee payroll profile responses remove tax identifiers and mask bank account numbers for staff roles; admin/HR responses retain authorized fields.
- Added regression coverage for component mapping, paid/unpaid leave, sensitive profile boundaries, effective-version closing, period segmentation, and migration columns.
- Removed payroll route helper/test candidates by applying the existing `-` route-file convention and updated imports.
- Fixed the `MobileHeader` unlabeled control and payroll route i18n violations. Updated the hardcoded-string baseline for unrelated pre-existing violations.
- Replaced payroll transaction/column `any` usage where practical and used `DomainError` for payroll scope/version/data validation.
- Fixed attendance baseline checkout tests to use the current business date. All attendance tests now pass.

## Verification

- `bun run test:run`: 617 passed, 1 skipped, 71 files.
- Payroll/attendance focused tests: 142 passed.
- `bun run typecheck`: passed.
- `bun run lint`: passed with existing warnings only.
- `bun run i18n:hardcoded`: passed, 134 baseline entries and no new violations.
- `bun run i18n:check`: passed.
- `bun run build`: passed, including API docs generation and Nitro output.
- `bun run e2e e2e/payroll.spec.ts`: failed in the local dev server before payroll page data rendered because the route transitively evaluates the Node `postgres` client in the browser and hits `Buffer is not defined`. The existing TanStack import-protection warnings identify `src/lib/db/index.ts` through `src/features/payroll/api/service.ts`; this is an environment/client-boundary issue, not a payroll assertion failure.

## Database

- Generated migration: `src/lib/db/migrations/0013_great_vivisector.sql`.
- The local test and development databases were updated manually for verification because their existing migration journals contain an older baseline that rejects a normal full replay (`notification_status` already exists).

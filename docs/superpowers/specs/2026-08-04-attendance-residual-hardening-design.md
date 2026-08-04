# Attendance Residual Hardening Design

## Scope

This work addresses the remaining attendance and delivery findings without
changing the deferred MVP decisions. It covers checkout selfie state, business
timezone date resolution, XLSX export dependency hardening, HR attendance
permissions, missing test coverage, and related documentation/process notes.

Remote branches will not be changed. The completed work will be verified
locally and prepared for a later review and push.

## Decisions

- HR retains full `attendance.edit` access. This is an intentional product and
  authorization decision and will be documented.
- Business timezone is configurable through application settings, with
  `Asia/Jakarta` (WIB, UTC+7) as the default. Attendance date defaults must not
  derive from UTC `toISOString()`.
- XLSX export remains available. XLSX-specific package usage will be isolated
  behind the export adapter and migrated to a maintained official SheetJS
  distribution compatible with the current server-side buffer API.
- Schedule policy overrides remain deferred and are not implemented in this
  work.
- The custom MapLibre wrapper remains in place while the mapcn registry is
  unavailable.

## Implementation

### Attendance state

After a successful checkout mutation, invalidate attendance queries and clear
`checkOutSelfie`. Error responses must leave the captured selfie available so
the user can retry without recapturing it.

### Business dates

Introduce or reuse a small pure date helper that accepts an instant and an IANA
timezone, returning the business date as `YYYY-MM-DD`. The attendance data
access default uses the configured business timezone and falls back to
`Asia/Jakarta`. Explicit date arguments remain unchanged.

The helper must be tested around UTC date boundaries and must avoid local
machine timezone assumptions.

### XLSX export

Keep the existing export response contract and XLSX output. Move the package
import and workbook-writing details into a focused adapter. Use the official
SheetJS-supported distribution and preserve `XLSX.write` with `type: 'buffer'`
and `bookType: 'xlsx'`. Add tests for workbook generation, file metadata, and
readability where the test environment supports it.

### Permissions and documentation

Keep HR's `attendance.edit` permission. Update the permission/API/product
documentation to make the decision explicit. Record schedule policy overrides,
MapLibre workaround, skipped product e2e coverage, checkout selfie e2e gap,
and manual migration synchronization as tracked residual/deferred items.

### Test coverage

- Add unit coverage for successful checkout selfie reset and failed checkout
  retention.
- Add unit coverage for business timezone date conversion at boundaries.
- Add e2e coverage for checkout selfie success and `selfie_required` failure or
  success paths.
- Repair product CRUD e2e assumptions to match the current product UI. Do not
  restore removed `react-dropzone` behavior merely to satisfy old tests.

## Verification

Run the relevant unit and e2e tests, lint, typecheck, build, and dependency
audit. Review `git status`, the full diff, and the commit history. Stage only
intended files. Do not push to `origin/main`.

## Out of Scope

- Implementing schedule-level policy overrides.
- Migrating the custom MapLibre wrapper to mapcn.
- Reverting or rewriting existing user documentation changes in the worktree.
- Pushing local commits to the remote repository.

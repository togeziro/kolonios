# Payroll Module

Full payroll calculation engine with payslip PDF generation, admin UI, and employee self-service. MVP excludes overtime calculation.

## Overview

The payroll module calculates employee salaries for custom date periods (not necessarily calendar months) and produces immutable, auditable payslips. It supports monthly, daily, and hourly salary types with configurable components (fixed, percentage, per-attendance, manual), progressive and TER tax methods, and attendance-based deductions.

## Key Design Decisions

- **No overtime in MVP** — overtime integration is reserved for a future Overtime module; the calculator returns zero for overtime hours and amounts.
- **No new dependencies** — all payroll functionality uses existing project dependencies (Bun, Drizzle, Zod, React Query, TanStack Table, pdf-lib, SheetJS).
- **Custom payroll periods** — periods are defined by `start_date`/`end_date` (e.g., `08 Jun 2026 - 07 Jul 2026`), not calendar months.
- **Effective-dated data** — salary assignments, tax profiles, benefit enrollments, bank accounts, and employment events preserve history; payroll calculation resolves data as of the period start and snapshots all resolved inputs immutably.
- **Immutable payslips** — locked payroll periods are immutable; payslip data comes from the `calculation_snapshot` stored in `payroll_records`.
- **State machine** — payroll periods progress through `draft → processing → ready_to_pay → paid → locked`; locked periods cannot be modified.

## Database Schema

13 new tables in `src/lib/db/schema/payroll.ts`:

| Table | Purpose |
|-------|---------|
| `payroll_periods` | Custom date periods with status machine |
| `payroll_records` | Per-employee per-period calculation results |
| `payslips` | Per-component payslip breakdown per record |
| `payslip_rows` | Individual line items on a payslip |
| `salary_assignments` | Effective-dated salary basis per employee |
| `salary_components` | Configurable allowance/deduction components |
| `employee_salary_components` | Per-employee component overrides |
| `tax_profiles` | Configurable tax settings (progressive/TER) |
| `employee_tax_profiles` | Per-employee tax inputs (PTKP, residency, etc.) |
| `benefit_enrollments` | BPJS and future benefit enrollments |
| `bank_accounts` | Payment accounts with primary flag and history |
| `employment_events` | Career changes with effective dates |
| `audit_log` | Payroll mutation audit events |

## Calculation Engine

Pure function at `src/features/payroll/utils/calculator.ts`:

- **Salary** — resolved from `salary_assignments` by period start date; supports monthly, daily, and hourly types
- **Components** — each component resolved by effective date; supports fixed, percentage, per-attendance, and manual modes
- **Attendance deductions** — configurable absent days, late minutes, and unpaid leave deductions
- **Tax** — progressive (bracket-based) or TER (percentage-based), selected per employee tax profile
- **Overtime** — returns zero in MVP; integration boundary preserved for future Overtime module
- **Snapshot** — full calculation input/output stored in `payroll_records.calculation_snapshot`

## Server Functions

All server functions are in `src/features/payroll/api/service.ts` with Zod validation and permission guards:

| Permission | Functions |
|------------|-----------|
| `payroll.view` | List components, profiles, periods, records; list/download payslips |
| `payroll.add` | Create components, periods; generate payroll |
| `payroll.edit` | Update components, profiles, periods; approve/pay/lock records; adjust records |
| `payroll.approve` | Approve payroll records |
| `payroll.pay` | Record payroll payment |
| `payroll.reports` | Export reports (CSV/XLSX) |

## UI Routes

### Admin

| Route | Page |
|-------|------|
| `/dashboard/admin/payroll/overview` | Dashboard with summary cards |
| `/dashboard/admin/payroll/components` | Salary component CRUD |
| `/dashboard/admin/payroll/profiles` | Employee payroll profiles |
| `/dashboard/admin/payroll/periods` | Payroll period management |
| `/dashboard/admin/payroll/generate` | Generate payroll for a period |
| `/dashboard/admin/payroll/records` | Payroll records with approve/pay actions |
| `/dashboard/admin/payroll/reports` | Reports with CSV/XLSX export |

### Employee

| Route | Page |
|-------|------|
| `/dashboard/payroll/payslips` | My payslip history |
| `/dashboard/payroll/payslips/[id]` | View/download individual payslip |

## Security

- All server functions enforce `requireSession()` and `requirePermission(module, action)`
- Employee-scoped payslip queries filter by `session.user.id`
- Sensitive fields (`tax_identifier`, `account_number`) are masked in employee responses
- Payslip PDF uses company data from `calculation_snapshot`, not live employee records
- Bank account numbers are redacted in payslip responses
- Locked payroll periods are immutable

## Testing

- 617 tests passing (unit, integration, E2E)
- Payroll-focused tests cover calculation engine, server functions, and payslip scoping
- Typecheck, lint, i18n, and build all clean

## Related Documents

- [PAYROLL_WORK_PLAN.md](./PAYROLL_WORK_PLAN.md) — Detailed work plan
- [Payroll Design Spec](../superpowers/specs/2026-08-05-payroll-system-design.md) — Design specification
- [Payroll Implementation Plan](../superpowers/plans/2026-08-05-payroll-system.md) — Implementation plan
# Payroll System Design

**Date:** 2026-08-05  
**Status:** Approved for planning  
**Scope:** Payroll MVP without overtime calculation  

## Goals

- Calculate payroll for monthly, daily, and hourly employees.
- Support configurable attendance deductions and manual adjustments.
- Support both progressive and TER PPh 21 methods through configuration.
- Produce auditable payslips and payroll reports.
- Preserve salary, tax, benefit, bank, and employment history as the system scales.

## Explicit Constraints

- Overtime is not calculated in the MVP. The calculator exposes a future integration
  boundary and records zero overtime until the Overtime module exists.
- No new framework, library, runtime, or dependency may be added without explicit
  user approval.
- Existing PostgreSQL, Drizzle, Zod, React Query, TanStack Table, `pdf-lib`, and
  SheetJS tooling are reused.
- File storage is not part of the MVP. Employee documents store metadata only and
  use the existing upload validation pattern if storage is added later.

## Architecture

The feature follows the existing feature-sliced architecture:

- `src/lib/db/schema/payroll.ts` contains payroll and employee payroll schemas.
- `src/lib/db/payroll.ts` contains server-only data access wrapped by `mapDbError`.
- `src/features/payroll/api/service.ts` exposes Zod-validated server functions.
- `src/features/payroll/utils/calculator.ts` contains pure calculation logic.
- React Query handles period, record, component, and payslip state.
- Payroll routes use the existing dashboard route and loading/error conventions.

## Data Model

### Payroll master and results

- `salary_components`: reusable allowance and deduction definitions.
- `employee_salary_assignments`: effective-dated monthly, daily, or hourly base salary.
- `employee_salary_components`: effective-dated employee component assignments.
- `payroll_periods`: arbitrary start/end dates, payment date, and workflow status.
- `payroll_records`: one result per employee and period, including a calculation snapshot.
- `payslips`: immutable line-item breakdown associated with a payroll record.
- `tax_settings`: company-level progressive brackets, TER rates, and default method.
- `employee_tax_profiles`: effective-dated taxpayer type, PTKP, residency, facility,
  tax object code, and company-setting override.
- `employee_tax_records`: period-level tax result and tax calculation snapshot.

### Employee payroll and history

- `employee_benefit_enrollments`: BPJS and future benefit enrollments and contributions.
- `employee_bank_accounts`: payment accounts with effective dates and one primary account.
- `employee_employment_events`: division, designation, and employment-status changes.
- `employee_documents`: document metadata, verification, and expiry information.

Payroll data is not added as mutable bank or tax columns on `employees`. At payroll
generation time, the system resolves all effective-dated records for the period and
stores the resolved inputs in `payroll_records.calculation_snapshot`.

## Calculation Flow

1. HR creates an arbitrary payroll period, such as 08 Jun - 07 Jul.
2. The system resolves each active employee's salary, components, tax profile,
   benefits, bank account, employment event, attendance, and approved leave.
3. Base salary is calculated according to monthly, daily, or hourly type.
4. Allowances and deductions are calculated as fixed, percentage, per-attendance,
   or manual values.
5. Configured attendance deductions cover absence, lateness, and unpaid leave.
6. Overtime remains zero in the MVP and is reserved for a future approved overtime
   integration.
7. Tax is calculated using the selected progressive or TER method.
8. Gross, deductions, tax, and net pay are stored with a complete input/output snapshot.
9. HR reviews and adjusts records, then marks them `ready_to_pay`.
10. Payment processing marks records `paid`; locking makes the period and payslips immutable.

## Workflow and Authorization

Permission keys use the existing matrix:

- `payroll.view`: view payroll and own payslips.
- `payroll.add`: create periods, salary components, and generate payroll.
- `payroll.edit`: edit unlocked payroll inputs and employee payroll profiles.
- `payroll.approve`: approve and mark payroll ready to pay.
- `payroll.pay`: record payment.
- `payroll.delete`: delete only unlocked configuration or draft records where allowed.
- `payroll.reports`: view and export payroll reports.

Employee payslip queries must always be scoped to the authenticated employee. Admin
and HR access is enforced at the server-function boundary with `requirePermission`.
All mutations use audit logging and rate-limit sensitive write operations according
to existing project conventions.

## UI Scope

Admin routes:

- Payroll overview
- Salary components
- Employee payroll profile
- Payroll periods
- Generate/review payroll
- Ready-to-pay and paid payroll
- Reports and exports

Employee route:

- Own payslip history and PDF download

Tables use the existing TanStack Table patterns. Payslips display only the necessary
bank account summary and never expose unnecessary account data.

## Error Handling

- Validate every server-function input with Zod.
- Reject overlapping effective-dated salary assignments and primary bank accounts.
- Reject generation for invalid periods or locked periods.
- Reject edits after a period is locked.
- Use `DomainError` for expected validation and workflow failures.
- Map unexpected database errors through `mapDbError` without leaking schema details.

## Testing Strategy

- Unit-test salary type, component, attendance deduction, and tax calculations.
- Unit-test effective-date resolution and overlap constraints.
- Unit-test calculation snapshot and locked-period immutability.
- Integration-test CRUD, generation, approval, payment, and audit behavior.
- E2E-test HR generation through paid payroll and employee own-payslip access.
- Verify employee users cannot read another employee's payroll records.

## Acceptance Criteria

- Payroll can be generated for a custom date range without overtime data.
- Monthly, daily, and hourly salary types calculate correctly.
- HR can configure automatic/manual absence, late, and unpaid-leave deductions.
- Progressive and TER tax methods can be selected by configuration.
- BPJS, tax, bank, salary, and employment history are preserved by effective date.
- A locked payroll cannot be recalculated or edited.
- Employees can view only their own paid payslips.
- No new dependency is introduced without explicit approval.

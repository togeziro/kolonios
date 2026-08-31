-- Split the personal payslips access from the admin payroll module:
-- field-role groups (Technician, Employee, SPV) lose `payroll.view` and gain
-- `payslips.view`; Admin and HR groups are untouched so they keep admin
-- payroll access and personal payslips access (via `payslips.view` from the
-- updated coreModules spread in scripts/seed.ts).
--
-- The mutation is idempotent: removing an absent key and inserting an
-- existing key are both no-ops in jsonb `||`, so re-running this migration
-- is safe.
UPDATE "role_groups"
SET
  "permissions" = (COALESCE("permissions", '{}'::jsonb) #- '{payroll,view}')
    || jsonb_build_object('payslips', jsonb_build_object('view', true)),
  "updated_at" = NOW()
WHERE "id" IN ('zzzrg-employee', 'zzzrg-technician', 'zzzrg-spv');
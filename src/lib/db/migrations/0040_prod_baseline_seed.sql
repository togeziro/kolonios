-- Prod baseline seed: role groups + masterdata minimum so a fresh production
-- database (which never runs scripts/seed.ts) is usable, not empty.
--
-- Scope: 5 role groups (Admin, HR, Operation, Technician, Staff), 3 departments,
-- 5 designations, 1 location, 1 shift + Mon-Fri weekday rules, 6 leave-type
-- configs, 1 company payroll settings row, 3 salary components, 1 tax setting.
-- No users, employees, customers, or tickets are created here — those are real
-- tenant data entered via the UI.
--
-- Idempotent: every statement is guarded (ON CONFLICT DO NOTHING / NOT EXISTS /
-- conditional UPDATE), so re-running after a partial apply is safe. Existing
-- rows are never overwritten, except:
--   1. `zzzrg-admin` rows bootstrapped as 'Administrator' are renamed to 'Admin'
--      (the bootstrap script reuses the same id, so grants are unaffected).
--   2. Legacy `zzzrg-spv` / `zzzrg-employee` groups (pre-rename seed ids) have
--      their assignments moved to `zzzrg-operation` / `zzzrg-staff` and are then
--      removed, so dev databases converge to the same 5 groups as prod.
-- Permission JSON mirrors scripts/seed.ts seedRoleGroups (post-0032 state:
-- field groups hold payslips.view, never payroll.view).
INSERT INTO "role_groups" ("id", "name", "description", "permissions", "is_admin") VALUES
  ('zzzrg-admin', 'Admin', 'Full system access', '{}'::jsonb, true),
  ('zzzrg-hr', 'HR', 'Human resources access', '{"overview":{"view":true},"my_work":{"view":true},"attendance":{"view":true,"edit":true},"leave":{"view":true},"profile":{"view":true},"payslips":{"view":true},"employees":{"view":true,"add":true,"edit":true,"delete":true},"departments":{"view":true,"add":true,"edit":true},"designations":{"view":true,"add":true,"edit":true},"users":{"view":true},"audit_log":{"view":true},"attendance_admin":{"view":true},"settings":{"view":true,"edit":true},"payroll":{"view":true,"add":true,"edit":true,"delete":true,"approve":true,"pay":true,"reports":true}}'::jsonb, false),
  ('zzzrg-operation', 'Operation', 'Field operations - review and leave approval', '{"overview":{"view":true},"my_work":{"view":true},"attendance":{"view":true},"leave":{"view":true,"edit":true},"profile":{"view":true},"payslips":{"view":true},"jobs":{"view":true},"tickets":{"view":true,"add":true,"edit":true},"notifications":{"view":true},"schedule":{"view":true},"achievements":{"view":true},"checklist":{"view":true,"edit":true,"approve":true},"spv_review":{"view":true,"edit":true}}'::jsonb, false),
  ('zzzrg-technician', 'Technician', 'Field technician access', '{"overview":{"view":true},"my_work":{"view":true},"attendance":{"view":true},"leave":{"view":true},"profile":{"view":true},"payslips":{"view":true},"jobs":{"view":true},"tickets":{"view":true,"add":true,"edit":true},"notifications":{"view":true},"schedule":{"view":true},"achievements":{"view":true},"checklist":{"view":true,"edit":true}}'::jsonb, false),
  ('zzzrg-staff', 'Staff', 'Standard staff access', '{"overview":{"view":true},"my_work":{"view":true},"attendance":{"view":true},"leave":{"view":true},"profile":{"view":true},"payslips":{"view":true},"jobs":{"view":true},"tickets":{"view":true},"notifications":{"view":true}}'::jsonb, false)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "role_groups" SET "name" = 'Admin', "description" = 'Full system access', "is_admin" = true, "updated_at" = NOW() WHERE "id" = 'zzzrg-admin' AND "name" = 'Administrator';
--> statement-breakpoint
UPDATE "user" SET "role" = 'technician' WHERE "role" = 'employee' AND EXISTS (SELECT 1 FROM "user_role_groups" WHERE "user_role_groups"."user_id" = "user"."id" AND "user_role_groups"."role_group_id" = 'zzzrg-spv');
--> statement-breakpoint
UPDATE "user_role_groups" SET "role_group_id" = 'zzzrg-operation' WHERE "role_group_id" = 'zzzrg-spv';
--> statement-breakpoint
UPDATE "user_role_groups" SET "role_group_id" = 'zzzrg-staff' WHERE "role_group_id" = 'zzzrg-employee';
--> statement-breakpoint
DELETE FROM "role_groups" WHERE "id" IN ('zzzrg-spv', 'zzzrg-employee');
--> statement-breakpoint
INSERT INTO "departments" ("name", "code", "description") VALUES
  ('Administration', 'ADM', 'Administration and general affairs'),
  ('Human Resources', 'HR', 'Human resources'),
  ('Operation', 'OPS', 'Field operations')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "designations" ("name", "code", "department_id", "description") SELECT 'Administrator', 'ADMIN', "id", 'System administrator' FROM "departments" WHERE "code" = 'ADM' AND NOT EXISTS (SELECT 1 FROM "designations" WHERE "code" = 'ADMIN');
--> statement-breakpoint
INSERT INTO "designations" ("name", "code", "department_id", "description") SELECT 'HR Specialist', 'HR_SPEC', "id", 'Human resources specialist' FROM "departments" WHERE "code" = 'HR' AND NOT EXISTS (SELECT 1 FROM "designations" WHERE "code" = 'HR_SPEC');
--> statement-breakpoint
INSERT INTO "designations" ("name", "code", "department_id", "description") SELECT 'Operation Supervisor', 'OPS_SPV', "id", 'Field operations supervisor' FROM "departments" WHERE "code" = 'OPS' AND NOT EXISTS (SELECT 1 FROM "designations" WHERE "code" = 'OPS_SPV');
--> statement-breakpoint
INSERT INTO "designations" ("name", "code", "department_id", "description") SELECT 'Field Technician', 'FLD_TECH', "id", 'Field technician' FROM "departments" WHERE "code" = 'OPS' AND NOT EXISTS (SELECT 1 FROM "designations" WHERE "code" = 'FLD_TECH');
--> statement-breakpoint
INSERT INTO "designations" ("name", "code", "department_id", "description") SELECT 'Staff', 'STAFF', "id", 'General staff' FROM "departments" WHERE "code" = 'ADM' AND NOT EXISTS (SELECT 1 FROM "designations" WHERE "code" = 'STAFF');
--> statement-breakpoint
INSERT INTO "locations" ("name", "latitude", "longitude", "radius", "description", "status", "gps_validation_enabled", "selfie_required", "max_accuracy_meters", "max_stale_ms") SELECT 'Head Office', -6.2088, 106.8456, 100, 'Main office - update address and coordinates via UI', 'active', true, false, 50, 30000 WHERE NOT EXISTS (SELECT 1 FROM "locations" WHERE "name" = 'Head Office');
--> statement-breakpoint
INSERT INTO "shifts" ("name", "start_time", "end_time", "type", "status", "late_tolerance_minutes", "absence_cutoff_minutes") SELECT 'Morning Shift', '08:00', '17:00', 'fixed'::"shift_type", 'active'::"shift_status", 10, 120 WHERE NOT EXISTS (SELECT 1 FROM "shifts" WHERE "name" = 'Morning Shift');
--> statement-breakpoint
INSERT INTO "shift_weekday_rules" ("shift_id", "day_of_week", "is_working_day", "start_time", "end_time") SELECT "id", "d", true, '08:00', '17:00' FROM "shifts" CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS "v"("d") WHERE "shifts"."name" = 'Morning Shift' ON CONFLICT ("shift_id", "day_of_week") DO NOTHING;
--> statement-breakpoint
INSERT INTO "leave_type_configs" ("leave_type", "attachment_required", "is_paid") VALUES
  ('annual'::"leave_type", false, true),
  ('sick'::"leave_type", true, true),
  ('personal'::"leave_type", false, true),
  ('emergency'::"leave_type", false, true),
  ('maternity'::"leave_type", false, true),
  ('paternity'::"leave_type", false, true)
ON CONFLICT ("leave_type") DO NOTHING;
--> statement-breakpoint
INSERT INTO "company_payroll_settings" ("company_npwp") SELECT '' WHERE NOT EXISTS (SELECT 1 FROM "company_payroll_settings");
--> statement-breakpoint
INSERT INTO "salary_components" ("code", "name", "type", "description") VALUES
  ('TUNJ-TRANSPORT', 'Tunjangan Transport', 'allowance'::"salary_component_type", 'Monthly transport allowance'),
  ('TUNJ-MAKAN', 'Tunjangan Makan', 'allowance'::"salary_component_type", 'Monthly meal allowance'),
  ('POT-PINJAMAN', 'Potongan Pinjaman', 'deduction'::"salary_component_type", 'Loan installment deduction')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tax_settings" ("code", "name", "rates", "effective_from") VALUES
  ('STD-NONE', 'Tanpa pajak (default)', '{"method":"none","ptkp":"0"}'::jsonb, '2026-01-01')
ON CONFLICT ("code", "effective_from") DO NOTHING;

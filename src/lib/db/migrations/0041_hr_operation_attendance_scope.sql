-- HR gains attendance corrections + schedule-grid management
-- (`attendance_admin.edit`, which gates every correction and schedule write);
-- Operation gains read-only visibility of attendance management
-- (`attendance_admin.view`: reports read + schedule export).
--
-- Idempotent: the `NOT ... @>` guard makes re-running a literal no-op, and
-- jsonb `||` only touches the `attendance_admin` key, so any other custom
-- permission on these groups is preserved. Mirrors scripts/seed.ts.
UPDATE "role_groups"
SET
  "permissions" = COALESCE("permissions", '{}'::jsonb)
    || '{"attendance_admin":{"view":true,"edit":true}}'::jsonb,
  "updated_at" = NOW()
WHERE "id" = 'zzzrg-hr'
  AND NOT (
    COALESCE("permissions", '{}'::jsonb) @> '{"attendance_admin":{"view":true,"edit":true}}'::jsonb
  );
--> statement-breakpoint
UPDATE "role_groups"
SET
  "permissions" = COALESCE("permissions", '{}'::jsonb)
    || '{"attendance_admin":{"view":true}}'::jsonb,
  "updated_at" = NOW()
WHERE "id" = 'zzzrg-operation'
  AND NOT (
    COALESCE("permissions", '{}'::jsonb) @> '{"attendance_admin":{"view":true}}'::jsonb
  );

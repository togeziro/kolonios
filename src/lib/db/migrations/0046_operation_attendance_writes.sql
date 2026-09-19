-- Codify the Operation grants made manually in prod: full attendance_admin
-- writes (`add`/`edit`/`delete`, no `reports`) so supervisors can run the
-- Assignments page and schedule grid, plus read-only `settings.view` (used
-- by the Branding page; Face Settings itself requires `settings.edit`).
--
-- Idempotent and prod-safe: the `NOT ... @>` guard makes re-running (and
-- running against prod, which already holds these keys) a literal no-op.
-- Parent-level `||` merges (not `jsonb_set`, which silently skips missing
-- parents) preserve sibling keys such as `attendance_admin.view` and
-- `settings.edit`. Mirrors scripts/seed.ts.
UPDATE "role_groups"
SET
  "permissions" = COALESCE("permissions", '{}'::jsonb)
    || jsonb_build_object(
      'attendance_admin',
      COALESCE("permissions" -> 'attendance_admin', '{}'::jsonb)
        || '{"add":true,"edit":true,"delete":true}'::jsonb,
      'settings',
      COALESCE("permissions" -> 'settings', '{}'::jsonb) || '{"view":true}'::jsonb
    ),
  "updated_at" = NOW()
WHERE "id" = 'zzzrg-operation'
  AND NOT (
    COALESCE("permissions", '{}'::jsonb) @> '{"attendance_admin":{"add":true,"edit":true,"delete":true},"settings":{"view":true}}'::jsonb
  );

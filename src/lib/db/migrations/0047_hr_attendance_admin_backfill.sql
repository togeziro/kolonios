-- HR holds `attendance_admin.edit` (via 0041) but never received the
-- `add` / `delete` / `reports` actions that 0045 meant to grant alongside
-- it: 0045's `#>> ... = 'true'` guard evaluates to NULL (not false) for
-- missing keys, so its WHERE clause silently matched nothing. As a result
-- HR gets `Forbidden` creating shifts, deleting locations, and opening the
-- attendance Reports page in prod, while scripts/seed.ts grants full access.
--
-- This backfills the three missing actions for HR only. Idempotent: the
-- `NOT ... @>` guard (NULL-safe, unlike `#>>` comparisons) makes
-- re-running a literal no-op, and the parent-level `||` merge (not
-- `jsonb_set`, which silently skips missing parents) preserves sibling
-- keys such as `view` and `edit`. Mirrors scripts/seed.ts.
UPDATE "role_groups"
SET
  "permissions" = COALESCE("permissions", '{}'::jsonb)
    || jsonb_build_object(
      'attendance_admin',
      COALESCE("permissions" -> 'attendance_admin', '{}'::jsonb)
        || '{"add":true,"delete":true,"reports":true}'::jsonb
    ),
  "updated_at" = NOW()
WHERE "id" = 'zzzrg-hr'
  AND NOT (
    COALESCE("permissions", '{}'::jsonb) @> '{"attendance_admin":{"add":true,"delete":true,"reports":true}}'::jsonb
  );

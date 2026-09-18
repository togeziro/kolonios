-- Split the `attendance_admin` module into individually grantable actions
-- (view / add / edit / delete / reports) so the role-group matrix exposes
-- real guards instead of a single `edit` catch-all.
--
-- Behaviour-preserving: `edit` previously implied creates, shift deletes,
-- grid clears, and report read/export, so every non-admin group holding
-- `attendance_admin.edit` gains `add`, `delete`, and `reports`. The
-- location-delete guard already required the otherwise-ungrantable `delete`
-- action, so no group loses anything it could previously do.
--
-- Idempotent: the `NOT ...` guard makes re-running a literal no-op, and
-- `jsonb_set` only touches the three new keys, preserving every other
-- permission on these groups. Mirrors scripts/seed.ts.
UPDATE "role_groups"
SET
  "permissions" = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE("permissions", '{}'::jsonb),
        '{attendance_admin,add}',
        'true'::jsonb
      ),
      '{attendance_admin,delete}',
      'true'::jsonb
    ),
    '{attendance_admin,reports}',
    'true'::jsonb
  ),
  "updated_at" = NOW()
WHERE NOT "is_admin"
  AND (COALESCE("permissions", '{}'::jsonb) #>> '{attendance_admin,edit}') = 'true'
  AND NOT (
    (COALESCE("permissions", '{}'::jsonb) #>> '{attendance_admin,add}') = 'true'
    AND (COALESCE("permissions", '{}'::jsonb) #>> '{attendance_admin,delete}') = 'true'
    AND (COALESCE("permissions", '{}'::jsonb) #>> '{attendance_admin,reports}') = 'true'
  );

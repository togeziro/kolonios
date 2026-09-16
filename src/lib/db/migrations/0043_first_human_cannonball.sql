-- Opsi B data remediation: normalize pre-existing inverted schedule_assignments
-- ranges BEFORE the CHECK constraint is added (Postgres validates existing rows
-- on ADD CONSTRAINT, so an incident-shaped DB would otherwise fail the upgrade).
--
-- An inverted row (`effective_from > effective_to`) is an empty range — it was
-- never active on any date. We REOPEN it (`effective_to = NULL`) rather than
-- delete it, preserving the audit trail of the corrupted assignment.
--
-- Why not the plain `UPDATE ... SET effective_to = NULL` for every inverted row?
-- Because `schedule_assignments_one_active_unique` allows at most ONE open-ended
-- row per user. On the actual prod incident shape (dhani: id=1 inverted 2026-09-14
-- → 2026-09-07 alongside id=2 open-ended from 2026-09-08), a blanket reopen would
-- create a second open row and fail with a unique-violation.
--
-- So: reopen the most recent inverted row for users that have no open-ended row
-- (where reopening is representable), and DELETE any inverted row that cannot be
-- reopened without breaking the one-open-row invariant. Deleting is safe because
-- the row covered no dates.
UPDATE "schedule_assignments" SET "effective_to" = NULL
WHERE "id" IN (
  SELECT DISTINCT ON (a."user_id") a."id"
  FROM "schedule_assignments" a
  WHERE a."effective_to" IS NOT NULL
    AND a."effective_from" > a."effective_to"
    AND NOT EXISTS (
      SELECT 1 FROM "schedule_assignments" b
      WHERE b."user_id" = a."user_id"
        AND b."effective_to" IS NULL
        AND b."id" <> a."id"
    )
  ORDER BY a."user_id", a."effective_from" DESC, a."id" DESC
);--> statement-breakpoint
DELETE FROM "schedule_assignments"
WHERE "effective_to" IS NOT NULL AND "effective_from" > "effective_to";--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_effective_range_check" CHECK ("schedule_assignments"."effective_to" IS NULL OR "schedule_assignments"."effective_from" <= "schedule_assignments"."effective_to");

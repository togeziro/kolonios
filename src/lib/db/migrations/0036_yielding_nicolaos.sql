ALTER TABLE "tickets" ADD COLUMN "first_taken_at" timestamp;
-- Backfill: for tickets already taken before this migration, first_taken_at = taken_at
-- (the pre-relay world never reset taken_at, so it already is the first-claim time).
UPDATE "tickets" SET "first_taken_at" = "taken_at" WHERE "first_taken_at" IS NULL AND "taken_at" IS NOT NULL;
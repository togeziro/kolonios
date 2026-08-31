ALTER TABLE "shift_weekday_rules" ALTER COLUMN "late_tolerance_minutes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shift_weekday_rules" ALTER COLUMN "absence_cutoff_minutes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "break_start" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "break_end" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "max_break_minutes" integer;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "late_tolerance_minutes" integer NOT NULL DEFAULT 5;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "absence_cutoff_minutes" integer NOT NULL DEFAULT 120;--> statement-breakpoint
UPDATE "shifts" SET "late_tolerance_minutes" = COALESCE(b.max_tol, 5) FROM (
  SELECT "shift_id", MAX("late_tolerance_minutes") AS max_tol
  FROM "shift_weekday_rules" GROUP BY "shift_id"
) b WHERE "shifts"."id" = b."shift_id";--> statement-breakpoint
UPDATE "shifts" SET "absence_cutoff_minutes" = COALESCE(b.max_cutoff, 120) FROM (
  SELECT "shift_id", MAX("absence_cutoff_minutes") AS max_cutoff
  FROM "shift_weekday_rules" GROUP BY "shift_id"
) b WHERE "shifts"."id" = b."shift_id";

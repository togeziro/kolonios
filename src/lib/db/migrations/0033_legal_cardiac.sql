ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "break_start" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "break_end" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "max_break_minutes" integer;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "color" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "note" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "late_tolerance_minutes" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "absence_cutoff_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "late_tolerance_minutes" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "late_tolerance_minutes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "absence_cutoff_minutes" SET DEFAULT 120;--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "absence_cutoff_minutes" SET NOT NULL;

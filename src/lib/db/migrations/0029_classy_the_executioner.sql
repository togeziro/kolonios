ALTER TABLE "payroll_records" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "paid_by" text;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Backfill ADR-0003 invariant: periods already paid/locked imply every record stamped.
UPDATE "payroll_records" pr SET "paid_at" = pp."paid_at", "paid_by" = NULL
FROM "payroll_periods" pp
WHERE pr."payroll_period_id" = pp."id"
  AND pp."status" IN ('paid', 'locked')
  AND pr."paid_at" IS NULL;

ALTER TABLE "schedule_assignments" DROP CONSTRAINT "schedule_assignments_effective_range_check";--> statement-breakpoint
DROP INDEX "schedule_assignments_one_active_unique";--> statement-breakpoint
ALTER TABLE "schedule_assignments" ALTER COLUMN "effective_to" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_effective_range_check" CHECK ("schedule_assignments"."effective_from" <= "schedule_assignments"."effective_to");
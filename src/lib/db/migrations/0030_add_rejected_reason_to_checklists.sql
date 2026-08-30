CREATE TYPE "public"."absence_deduction_mode" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."overtime_wage_type" AS ENUM('hourly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."salary_detail_basis" AS ENUM('per_month', 'per_attendance');--> statement-breakpoint
CREATE TABLE "employee_salary_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"billing_basis" "salary_detail_basis" DEFAULT 'per_month' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_checklists" ADD COLUMN "rejected_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "overtime_wage_type" "overtime_wage_type";--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "overtime_rate_workday" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "overtime_rate_saturday" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "overtime_rate_sunday" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "overtime_rate_holiday" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "leave_hour_deduction" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "shortfall_hour_deduction" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD COLUMN "absence_deduction_mode" "absence_deduction_mode";--> statement-breakpoint
ALTER TABLE "employee_salary_details" ADD CONSTRAINT "employee_salary_details_assignment_id_employee_salary_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."employee_salary_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_salary_details_assignment_idx" ON "employee_salary_details" USING btree ("assignment_id");
ALTER TABLE "leave_type_configs" ADD COLUMN "is_paid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD COLUMN "mode" text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD COLUMN "percentage_base" text;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD COLUMN "attendance_metric" text;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD COLUMN "taxable" boolean DEFAULT false NOT NULL;
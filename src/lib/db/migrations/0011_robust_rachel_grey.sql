DROP INDEX "payroll_records_id_employee_unique";--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_id_employee_unique" UNIQUE("id","employee_id");
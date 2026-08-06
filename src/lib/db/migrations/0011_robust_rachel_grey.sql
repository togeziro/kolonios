ALTER TABLE "employee_tax_records" DROP CONSTRAINT "employee_tax_records_payroll_record_employee_fk";--> statement-breakpoint
ALTER TABLE "payslips" DROP CONSTRAINT "payslips_payroll_record_employee_fk";--> statement-breakpoint
DROP INDEX "payroll_records_id_employee_unique";--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_id_employee_unique" UNIQUE("id","employee_id");--> statement-breakpoint
ALTER TABLE "employee_tax_records" ADD CONSTRAINT "employee_tax_records_payroll_record_employee_fk" FOREIGN KEY ("payroll_record_id","employee_id") REFERENCES "public"."payroll_records"("id","employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_record_employee_fk" FOREIGN KEY ("payroll_record_id","employee_id") REFERENCES "public"."payroll_records"("id","employee_id") ON DELETE cascade ON UPDATE no action;

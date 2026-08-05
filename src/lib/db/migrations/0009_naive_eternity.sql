ALTER TABLE "employee_tax_profiles" DROP CONSTRAINT "employee_tax_profiles_employee_id_unique";--> statement-breakpoint
ALTER TABLE "employee_tax_records" DROP CONSTRAINT "employee_tax_records_payroll_record_id_payroll_records_id_fk";
--> statement-breakpoint
ALTER TABLE "payslips" DROP CONSTRAINT "payslips_payroll_record_id_payroll_records_id_fk";
--> statement-breakpoint
ALTER TABLE "employee_tax_records" ADD CONSTRAINT "employee_tax_records_payroll_record_employee_fk" FOREIGN KEY ("payroll_record_id","employee_id") REFERENCES "public"."payroll_records"("id","employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_record_employee_fk" FOREIGN KEY ("payroll_record_id","employee_id") REFERENCES "public"."payroll_records"("id","employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_tax_profiles_employee_effective_unique" ON "employee_tax_profiles" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_records_id_employee_unique" ON "payroll_records" USING btree ("id","employee_id");
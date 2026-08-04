CREATE TYPE "public"."payroll_period_status" AS ENUM('draft', 'processing', 'ready_to_pay', 'paid', 'locked');--> statement-breakpoint
CREATE TYPE "public"."salary_component_type" AS ENUM('allowance', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."salary_type" AS ENUM('monthly', 'daily', 'hourly');--> statement-breakpoint
CREATE TABLE "employee_bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_benefit_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"benefit_code" text NOT NULL,
	"benefit_name" text NOT NULL,
	"amount" numeric(14, 2),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"issued_date" date,
	"expiry_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_employment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"event_type" text NOT NULL,
	"effective_date" date NOT NULL,
	"details" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_salary_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"department_id" integer,
	"designation_id" integer,
	"salary_type" "salary_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_salary_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"salary_component_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_tax_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"tax_setting_id" integer,
	"tax_identifier" text,
	"filing_status" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_tax_profiles_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "employee_tax_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"payroll_record_id" integer,
	"tax_period" date NOT NULL,
	"taxable_income" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "payroll_period_status" DEFAULT 'draft' NOT NULL,
	"processed_at" timestamp,
	"paid_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_period_id" integer NOT NULL,
	"employee_id" text NOT NULL,
	"gross_salary" numeric(14, 2) NOT NULL,
	"total_allowances" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_salary" numeric(14, 2) NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_record_id" integer NOT NULL,
	"employee_id" text NOT NULL,
	"payslip_number" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_payslip_number_unique" UNIQUE("payslip_number")
);
--> statement-breakpoint
CREATE TABLE "salary_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "salary_component_type" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "salary_components_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rates" jsonb NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_benefit_enrollments" ADD CONSTRAINT "employee_benefit_enrollments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_employment_events" ADD CONSTRAINT "employee_employment_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_employment_events" ADD CONSTRAINT "employee_employment_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD CONSTRAINT "employee_salary_components_assignment_id_employee_salary_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."employee_salary_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salary_components" ADD CONSTRAINT "employee_salary_components_salary_component_id_salary_components_id_fk" FOREIGN KEY ("salary_component_id") REFERENCES "public"."salary_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD CONSTRAINT "employee_tax_profiles_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD CONSTRAINT "employee_tax_profiles_tax_setting_id_tax_settings_id_fk" FOREIGN KEY ("tax_setting_id") REFERENCES "public"."tax_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tax_records" ADD CONSTRAINT "employee_tax_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_tax_records" ADD CONSTRAINT "employee_tax_records_payroll_record_id_payroll_records_id_fk" FOREIGN KEY ("payroll_record_id") REFERENCES "public"."payroll_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_record_id_payroll_records_id_fk" FOREIGN KEY ("payroll_record_id") REFERENCES "public"."payroll_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_bank_accounts_primary_unique" ON "employee_bank_accounts" USING btree ("employee_id") WHERE "employee_bank_accounts"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "employee_bank_accounts_employee_idx" ON "employee_bank_accounts" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_benefit_enrollments_employee_benefit_effective_unique" ON "employee_benefit_enrollments" USING btree ("employee_id","benefit_code","effective_from");--> statement-breakpoint
CREATE INDEX "employee_documents_employee_type_idx" ON "employee_documents" USING btree ("employee_id","document_type");--> statement-breakpoint
CREATE INDEX "employee_employment_events_employee_date_idx" ON "employee_employment_events" USING btree ("employee_id","effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salary_assignments_employee_effective_unique" ON "employee_salary_assignments" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE INDEX "employee_salary_assignments_employee_effective_idx" ON "employee_salary_assignments" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salary_components_assignment_component_effective_unique" ON "employee_salary_components" USING btree ("assignment_id","salary_component_id","effective_from");--> statement-breakpoint
CREATE INDEX "employee_salary_components_effective_idx" ON "employee_salary_components" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "employee_tax_records_employee_period_idx" ON "employee_tax_records" USING btree ("employee_id","tax_period");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_periods_dates_unique" ON "payroll_periods" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_records_period_employee_unique" ON "payroll_records" USING btree ("payroll_period_id","employee_id");--> statement-breakpoint
CREATE INDEX "payroll_records_employee_idx" ON "payroll_records" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_settings_code_effective_unique" ON "tax_settings" USING btree ("code","effective_from");
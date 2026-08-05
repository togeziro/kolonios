CREATE TYPE "public"."bpjs_program" AS ENUM('jkk', 'jkm', 'jht', 'jp', 'kesehatan');--> statement-breakpoint
CREATE TYPE "public"."employment_status_payroll" AS ENUM('permanent', 'contract', 'freelance');--> statement-breakpoint
CREATE TYPE "public"."jkk_risk_category" AS ENUM('very_low', 'low', 'medium', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."pph21_method" AS ENUM('gross', 'gross_up');--> statement-breakpoint
CREATE TYPE "public"."ptkp_status" AS ENUM('TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3');--> statement-breakpoint
CREATE TYPE "public"."residency" AS ENUM('resident', 'foreign');--> statement-breakpoint
CREATE TYPE "public"."tax_facility" AS ENUM('none', 'dtp', 'etc');--> statement-breakpoint
CREATE TYPE "public"."tax_object_code" AS ENUM('21-100-01', '21-100-02', '21-100-32');--> statement-breakpoint
CREATE TYPE "public"."tax_record_source" AS ENUM('calculated', 'manual');--> statement-breakpoint
CREATE TABLE "company_payroll_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_npwp" text DEFAULT '' NOT NULL,
	"cut_off_day" integer DEFAULT 7 NOT NULL,
	"pph21_enabled" boolean DEFAULT true NOT NULL,
	"pph21_method" "pph21_method" DEFAULT 'gross' NOT NULL,
	"jkk_enabled" boolean DEFAULT true NOT NULL,
	"jkm_enabled" boolean DEFAULT true NOT NULL,
	"jht_enabled" boolean DEFAULT true NOT NULL,
	"jp_enabled" boolean DEFAULT true NOT NULL,
	"bpjs_kesehatan_enabled" boolean DEFAULT true NOT NULL,
	"jkk_risk_category" "jkk_risk_category" DEFAULT 'low' NOT NULL,
	"jkm_company_rate" numeric(6, 4) DEFAULT '0.3' NOT NULL,
	"jht_company_rate" numeric(6, 4) DEFAULT '3.7' NOT NULL,
	"jht_employee_rate" numeric(6, 4) DEFAULT '2' NOT NULL,
	"jp_company_rate" numeric(6, 4) DEFAULT '2' NOT NULL,
	"jp_employee_rate" numeric(6, 4) DEFAULT '1' NOT NULL,
	"kesehatan_company_rate" numeric(6, 4) DEFAULT '4' NOT NULL,
	"kesehatan_employee_rate" numeric(6, 4) DEFAULT '1' NOT NULL,
	"potongan_izin_jam_default" numeric(14, 2) DEFAULT '0' NOT NULL,
	"potongan_shortfall_default" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_bpjs_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"program" "bpjs_program" NOT NULL,
	"membership_number" text DEFAULT '' NOT NULL,
	"registration_date" date,
	"registered_wage" numeric(14, 2) DEFAULT '0' NOT NULL,
	"jkk_category_override" "jkk_risk_category",
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_bpjs_family_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"birth_date" date,
	"is_core" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_attendance_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_period_id" integer NOT NULL,
	"employee_id" text NOT NULL,
	"scheduled_days" numeric(8, 2),
	"payable_days" numeric(8, 2),
	"worked_hours" numeric(8, 2),
	"permit_hours" numeric(8, 2),
	"shortfall_hours" numeric(8, 2),
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD COLUMN "employment_status" "employment_status_payroll" DEFAULT 'permanent' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD COLUMN "ptkp_status" "ptkp_status" DEFAULT 'TK/0' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD COLUMN "residency" "residency" DEFAULT 'resident' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD COLUMN "tax_facility" "tax_facility" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD COLUMN "tax_object_code" "tax_object_code" DEFAULT '21-100-01' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_tax_profiles" ADD COLUMN "pph21_method" "pph21_method";--> statement-breakpoint
ALTER TABLE "employee_tax_records" ADD COLUMN "source" "tax_record_source" DEFAULT 'calculated' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_tax_records" ADD COLUMN "is_overridden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_bpjs_enrollments" ADD CONSTRAINT "employee_bpjs_enrollments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_bpjs_family_members" ADD CONSTRAINT "employee_bpjs_family_members_enrollment_id_employee_bpjs_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."employee_bpjs_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_attendance_overrides" ADD CONSTRAINT "payroll_attendance_overrides_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_attendance_overrides" ADD CONSTRAINT "payroll_attendance_overrides_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_attendance_overrides" ADD CONSTRAINT "payroll_attendance_overrides_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_bpjs_enrollments_employee_program_effective_unique" ON "employee_bpjs_enrollments" USING btree ("employee_id","program","effective_from");--> statement-breakpoint
CREATE INDEX "employee_bpjs_enrollments_employee_idx" ON "employee_bpjs_enrollments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_bpjs_family_members_enrollment_idx" ON "employee_bpjs_family_members" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_attendance_overrides_period_employee_unique" ON "payroll_attendance_overrides" USING btree ("payroll_period_id","employee_id");--> statement-breakpoint
CREATE INDEX "payroll_attendance_overrides_employee_idx" ON "payroll_attendance_overrides" USING btree ("employee_id");
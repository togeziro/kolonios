CREATE TABLE "attendance_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"attendance_id" integer NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text NOT NULL,
	"previous_values" text,
	"new_values" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"shift_id" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_offs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"shift_id" integer NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_weekday_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_working_day" boolean DEFAULT true,
	"start_time" text,
	"end_time" text,
	"late_tolerance_minutes" integer DEFAULT 0,
	"absence_cutoff_minutes" integer DEFAULT 120,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD COLUMN "check_in_accuracy" real;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD COLUMN "check_in_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD COLUMN "check_out_accuracy" real;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD COLUMN "check_out_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD COLUMN "gps_validation_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD COLUMN "selfie_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "employee_shifts" ADD COLUMN "validation_state" text DEFAULT 'valid';--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "gps_validation_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "selfie_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "max_accuracy_meters" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "max_stale_ms" integer DEFAULT 30000;
CREATE TYPE "public"."career_event_category" AS ENUM('position', 'division', 'employment_status', 'start_work');--> statement-breakpoint
CREATE TABLE "employee_career_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"category" "career_event_category" NOT NULL,
	"effective_date" date NOT NULL,
	"notes" text,
	"actor_user_id" text,
	"from_designation_id" integer,
	"to_designation_id" integer,
	"from_department_id" integer,
	"to_department_id" integer,
	"from_label" text,
	"to_label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_career_events" ADD CONSTRAINT "employee_career_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_career_events" ADD CONSTRAINT "employee_career_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_career_events" ADD CONSTRAINT "employee_career_events_from_designation_id_designations_id_fk" FOREIGN KEY ("from_designation_id") REFERENCES "public"."designations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_career_events" ADD CONSTRAINT "employee_career_events_to_designation_id_designations_id_fk" FOREIGN KEY ("to_designation_id") REFERENCES "public"."designations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_career_events" ADD CONSTRAINT "employee_career_events_from_department_id_departments_id_fk" FOREIGN KEY ("from_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_career_events" ADD CONSTRAINT "employee_career_events_to_department_id_departments_id_fk" FOREIGN KEY ("to_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_career_events_employee_effective_idx" ON "employee_career_events" USING btree ("employee_id","effective_date" DESC NULLS LAST);--> statement-breakpoint
-- Backfill: seed one `start_work` event per existing employee, sourced
-- from `employees.join_date`, with `actor_user_id = NULL` (system-seeded).
-- Idempotent: skip employees that already have a `start_work` event so
-- re-running on a previously-seeded DB does not create duplicate rows.
-- Label format mirrors the user-facing "Joined the company 29 June 2026"
-- copy. Uses `to_char` so the rendering is locale-independent and stays
-- stable across server timezones.
INSERT INTO "employee_career_events" (
	"employee_id", "category", "effective_date", "notes",
	"actor_user_id", "from_label", "to_label",
	"created_at", "updated_at"
)
SELECT
	e."id",
	'start_work'::"career_event_category",
	e."join_date"::date,
	NULL,
	NULL,
	NULL,
	'Joined the company ' || to_char(e."join_date"::date, 'FMDD FMMonth FMYYYY'),
	NOW(),
	NOW()
FROM "employees" e
WHERE NOT EXISTS (
	SELECT 1 FROM "employee_career_events" ece
	WHERE ece."employee_id" = e."id"
	  AND ece."category" = 'start_work'
);
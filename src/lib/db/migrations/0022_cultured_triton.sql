CREATE TYPE "public"."ticket_worklog_kind" AS ENUM('note', 'photo', 'location', 'meter');--> statement-breakpoint
CREATE TABLE "ticket_worklog" (
	"id" serial PRIMARY KEY NOT NULL,
	"leg_id" integer NOT NULL,
	"kind" "ticket_worklog_kind" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "ticket_worklog" ADD CONSTRAINT "ticket_worklog_leg_id_ticket_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."ticket_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_worklog" ADD CONSTRAINT "ticket_worklog_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
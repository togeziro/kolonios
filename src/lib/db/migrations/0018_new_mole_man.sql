CREATE TYPE "public"."ticket_channel" AS ENUM('whatsapp', 'phone', 'email', 'walk_in', 'field');--> statement-breakpoint
CREATE TYPE "public"."ticket_leg_status" AS ENUM('open', 'assigned', 'in_progress', 'submitted', 'approved', 'rejected', 'rework', 'completed');--> statement-breakpoint
CREATE TYPE "public"."ticket_material_source" AS ENUM('warehouse', 'van');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'assigned', 'in_progress', 'submitted', 'approved', 'rejected', 'rework', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ticket_task_type" AS ENUM('installation', 'maintenance', 'inspection', 'data', 'sales');--> statement-breakpoint
CREATE TABLE "ticket_legs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"leg_number" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "ticket_leg_status" DEFAULT 'open' NOT NULL,
	"assignee_id" text,
	"taken_at" timestamp,
	"completed_at" timestamp,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"leg_id" integer NOT NULL,
	"material_name" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"source" "ticket_material_source" DEFAULT 'van' NOT NULL,
	"barcode" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"leg_id" integer NOT NULL,
	"file_url" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"uploader_id" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_code" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"channel" "ticket_channel" DEFAULT 'field' NOT NULL,
	"requester_id" text,
	"customer_id" text,
	"asset_name" text DEFAULT '' NOT NULL,
	"task_type" "ticket_task_type" DEFAULT 'installation' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"location_id" integer,
	"due_at" timestamp,
	"estimated_minutes" integer,
	"assigned_to" text,
	"taken_by" text,
	"taken_at" timestamp,
	"completed_at" timestamp,
	"submitted_at" timestamp,
	"reviewed_by" text,
	"review_note" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tasks" CASCADE;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_materials" ADD CONSTRAINT "ticket_materials_leg_id_ticket_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."ticket_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_photos" ADD CONSTRAINT "ticket_photos_leg_id_ticket_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."ticket_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_photos" ADD CONSTRAINT "ticket_photos_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_taken_by_user_id_fk" FOREIGN KEY ("taken_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_legs_ticket_leg_number_unique" ON "ticket_legs" USING btree ("ticket_id","leg_number");--> statement-breakpoint
ALTER TABLE "task_requirements" ADD CONSTRAINT "task_requirements_task_id_tickets_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."task_priority";--> statement-breakpoint
DROP TYPE "public"."task_status";
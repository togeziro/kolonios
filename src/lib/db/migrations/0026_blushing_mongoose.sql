CREATE TYPE "public"."checklist_item_outcome" AS ENUM('ok', 'issue', 'pending');--> statement-breakpoint
CREATE TYPE "public"."daily_checklist_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "daily_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"checklist_id" integer NOT NULL,
	"item_key" text NOT NULL,
	"outcome" "checklist_item_outcome" DEFAULT 'pending' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"photo_key" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"checklist_date" text NOT NULL,
	"shift_id" integer,
	"shift_name" text DEFAULT '' NOT NULL,
	"shift_start_time" text DEFAULT '' NOT NULL,
	"shift_end_time" text DEFAULT '' NOT NULL,
	"status" "daily_checklist_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"global_note" text DEFAULT '' NOT NULL,
	"reviewer_id" text,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_checklist_items" ADD CONSTRAINT "daily_checklist_items_checklist_id_daily_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."daily_checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklists" ADD CONSTRAINT "daily_checklists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklists" ADD CONSTRAINT "daily_checklists_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklists" ADD CONSTRAINT "daily_checklists_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checklist_items_checklist_item_unique" ON "daily_checklist_items" USING btree ("checklist_id","item_key");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checklists_user_date_unique" ON "daily_checklists" USING btree ("user_id","checklist_date");
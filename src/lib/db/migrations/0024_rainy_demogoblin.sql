ALTER TABLE "company_settings" ADD COLUMN "face_validation_mode" text DEFAULT 'background' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "face_accuracy_level" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "show_seconds" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "face_descriptor" json;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "face_registered_at" timestamp with time zone;
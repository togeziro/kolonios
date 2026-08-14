ALTER TABLE "company_settings" ADD COLUMN "storage_provider" text DEFAULT 'idrive_e2' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "storage_endpoint" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "storage_region" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "storage_bucket" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "storage_access_key" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "storage_secret_key" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "storage_force_path_style" boolean DEFAULT false NOT NULL;
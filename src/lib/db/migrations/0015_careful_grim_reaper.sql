CREATE TYPE "public"."holiday_source" AS ENUM('manual', 'imported');--> statement-breakpoint
CREATE TABLE "national_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"year" integer,
	"source" "holiday_source" DEFAULT 'manual' NOT NULL,
	"is_override" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "national_holidays_date_unique" ON "national_holidays" USING btree ("date");
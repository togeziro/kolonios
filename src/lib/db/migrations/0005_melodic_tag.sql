CREATE TABLE "leave_type_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"attachment_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_type_configs_leave_type_unique" UNIQUE("leave_type")
);

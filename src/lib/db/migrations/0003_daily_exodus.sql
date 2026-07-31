CREATE TABLE "role_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_role_groups" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role_group_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_role_groups" ADD CONSTRAINT "user_role_groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_groups" ADD CONSTRAINT "user_role_groups_role_group_id_role_groups_id_fk" FOREIGN KEY ("role_group_id") REFERENCES "public"."role_groups"("id") ON DELETE cascade ON UPDATE no action;
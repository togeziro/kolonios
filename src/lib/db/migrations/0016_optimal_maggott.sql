CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"holiday_api_provider" text DEFAULT 'nager_date' NOT NULL,
	"holiday_api_url" text,
	"holiday_api_key" text,
	"holiday_api_country_code" text DEFAULT 'ID' NOT NULL,
	"holiday_api_headers" json DEFAULT '{}'::json NOT NULL,
	"holiday_api_response_mapping" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

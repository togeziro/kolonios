ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
-- Better Auth >=1.7 requires credential accounts to carry the synthetic local
-- issuer and to be keyed by the owning user's id; legacy rows predate both.
UPDATE "account" SET "issuer" = 'local:credential' WHERE "provider_id" = 'credential' AND "issuer" IS NULL;--> statement-breakpoint
UPDATE "account" SET "account_id" = "user_id" WHERE "provider_id" = 'credential' AND "account_id" <> "user_id";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

DROP INDEX "employee_bank_accounts_primary_unique";--> statement-breakpoint
ALTER TABLE "employee_bank_accounts" ADD COLUMN "effective_from" date;--> statement-breakpoint
UPDATE "employee_bank_accounts" SET "effective_from" = "created_at"::date WHERE "effective_from" IS NULL;--> statement-breakpoint
ALTER TABLE "employee_bank_accounts" ALTER COLUMN "effective_from" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_bank_accounts" ADD COLUMN "effective_to" date;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_bank_accounts_primary_effective_unique" ON "employee_bank_accounts" USING btree ("employee_id","effective_from") WHERE "employee_bank_accounts"."is_primary" = true;

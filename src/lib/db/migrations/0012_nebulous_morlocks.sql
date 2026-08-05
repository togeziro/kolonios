ALTER TABLE "payroll_periods" ADD COLUMN "payment_date" date;
UPDATE "payroll_periods" SET "payment_date" = "period_end" WHERE "payment_date" IS NULL;
ALTER TABLE "payroll_periods" ALTER COLUMN "payment_date" SET NOT NULL;

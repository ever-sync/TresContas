ALTER TABLE "ClientDocument"
ADD COLUMN IF NOT EXISTS "document_type" TEXT NOT NULL DEFAULT 'general';

ALTER TABLE "ClientDocument"
ADD COLUMN IF NOT EXISTS "period_year" INTEGER;

ALTER TABLE "ClientDocument"
ADD COLUMN IF NOT EXISTS "period_month" INTEGER;

CREATE INDEX IF NOT EXISTS "ClientDocument_document_type_idx"
ON "ClientDocument"("document_type");

CREATE INDEX IF NOT EXISTS "ClientDocument_period_year_idx"
ON "ClientDocument"("period_year");

CREATE INDEX IF NOT EXISTS "ClientDocument_period_month_idx"
ON "ClientDocument"("period_month");

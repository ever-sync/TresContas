ALTER TABLE "ChartOfAccounts"
ADD COLUMN IF NOT EXISTS "reduced_code" TEXT;

ALTER TABLE "MonthlyMovement"
ADD COLUMN IF NOT EXISTS "reduced_code" TEXT;

CREATE TABLE IF NOT EXISTS "DFCLineMapping" (
    "id" TEXT NOT NULL,
    "accounting_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "line_key" TEXT NOT NULL,
    "chart_account_id" TEXT NOT NULL,
    "account_code_snapshot" TEXT NOT NULL,
    "reduced_code_snapshot" TEXT,
    "source_type" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "include_children" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DFCLineMapping_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DFCLineMapping_accounting_id_fkey" FOREIGN KEY ("accounting_id") REFERENCES "Accounting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DFCLineMapping_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DFCLineMapping_chart_account_id_fkey" FOREIGN KEY ("chart_account_id") REFERENCES "ChartOfAccounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChartOfAccounts_client_id_reduced_code_key"
ON "ChartOfAccounts"("client_id", "reduced_code");

CREATE INDEX IF NOT EXISTS "MonthlyMovement_client_id_reduced_code_idx"
ON "MonthlyMovement"("client_id", "reduced_code");

CREATE UNIQUE INDEX IF NOT EXISTS "DFCLineMapping_client_id_line_key_chart_account_id_key"
ON "DFCLineMapping"("client_id", "line_key", "chart_account_id");

CREATE INDEX IF NOT EXISTS "DFCLineMapping_accounting_id_idx"
ON "DFCLineMapping"("accounting_id");

CREATE INDEX IF NOT EXISTS "DFCLineMapping_client_id_idx"
ON "DFCLineMapping"("client_id");

CREATE INDEX IF NOT EXISTS "DFCLineMapping_line_key_idx"
ON "DFCLineMapping"("line_key");

CREATE INDEX IF NOT EXISTS "DFCLineMapping_chart_account_id_idx"
ON "DFCLineMapping"("chart_account_id");

UPDATE "ChartOfAccounts" coa
SET "accounting_id" = c."accounting_id"
FROM "Client" c
WHERE coa."client_id" = c."id"
  AND coa."accounting_id" IS NULL;

WITH ranked AS (
    SELECT
        "id",
        "accounting_id",
        "code",
        ROW_NUMBER() OVER (
            PARTITION BY "accounting_id", "code"
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
        ) AS rn,
        FIRST_VALUE("id") OVER (
            PARTITION BY "accounting_id", "code"
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
        ) AS canonical_id
    FROM "ChartOfAccounts"
    WHERE "accounting_id" IS NOT NULL
),
duplicates AS (
    SELECT "id" AS duplicate_id, canonical_id
    FROM ranked
    WHERE rn > 1
)
UPDATE "DFCLineMapping" d
SET "chart_account_id" = dup.canonical_id
FROM duplicates dup
WHERE d."chart_account_id" = dup.duplicate_id;

WITH ranked AS (
    SELECT
        "id",
        "accounting_id",
        "code",
        ROW_NUMBER() OVER (
            PARTITION BY "accounting_id", "code"
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
        ) AS rn,
        FIRST_VALUE("id") OVER (
            PARTITION BY "accounting_id", "code"
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
        ) AS canonical_id
    FROM "ChartOfAccounts"
    WHERE "accounting_id" IS NOT NULL
),
duplicates AS (
    SELECT "id" AS duplicate_id, canonical_id
    FROM ranked
    WHERE rn > 1
)
UPDATE "AccountingEntryItem" item
SET "account_id" = dup.canonical_id
FROM duplicates dup
WHERE item."account_id" = dup.duplicate_id;

WITH ranked AS (
    SELECT
        "id",
        "accounting_id",
        "code",
        ROW_NUMBER() OVER (
            PARTITION BY "accounting_id", "code"
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
        ) AS rn
    FROM "ChartOfAccounts"
    WHERE "accounting_id" IS NOT NULL
)
DELETE FROM "ChartOfAccounts" coa
USING ranked r
WHERE coa."id" = r."id"
  AND r.rn > 1;

WITH ranked_reduced AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "accounting_id", "reduced_code"
            ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
        ) AS rn
    FROM "ChartOfAccounts"
    WHERE "accounting_id" IS NOT NULL
      AND "reduced_code" IS NOT NULL
)
UPDATE "ChartOfAccounts" coa
SET "reduced_code" = NULL
FROM ranked_reduced rr
WHERE coa."id" = rr."id"
  AND rr.rn > 1;

DROP INDEX IF EXISTS "ChartOfAccounts_client_id_code_key";
DROP INDEX IF EXISTS "ChartOfAccounts_client_id_reduced_code_key";

ALTER TABLE "ChartOfAccounts"
DROP CONSTRAINT IF EXISTS "ChartOfAccounts_client_id_fkey";

ALTER TABLE "ChartOfAccounts"
ALTER COLUMN "client_id" DROP NOT NULL;

UPDATE "ChartOfAccounts"
SET "client_id" = NULL;

ALTER TABLE "ChartOfAccounts"
ALTER COLUMN "accounting_id" SET NOT NULL;

ALTER TABLE "ChartOfAccounts"
ADD CONSTRAINT "ChartOfAccounts_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ChartOfAccounts_accounting_id_code_key"
ON "ChartOfAccounts"("accounting_id", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "ChartOfAccounts_accounting_id_reduced_code_key"
ON "ChartOfAccounts"("accounting_id", "reduced_code");

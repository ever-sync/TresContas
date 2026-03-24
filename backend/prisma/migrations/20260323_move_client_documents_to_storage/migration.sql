ALTER TABLE "ClientDocument"
ADD COLUMN IF NOT EXISTS "storage_path" TEXT;

ALTER TABLE "ClientDocument"
ALTER COLUMN "content" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ClientDocument_storage_path_idx"
ON "ClientDocument"("storage_path");

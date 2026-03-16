CREATE TABLE IF NOT EXISTS "ClientDocument" (
    "id" TEXT NOT NULL,
    "accounting_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClientDocument_accounting_id_fkey" FOREIGN KEY ("accounting_id") REFERENCES "Accounting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClientDocument_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientDocument_accounting_id_idx"
ON "ClientDocument"("accounting_id");

CREATE INDEX IF NOT EXISTS "ClientDocument_client_id_idx"
ON "ClientDocument"("client_id");

CREATE INDEX IF NOT EXISTS "ClientDocument_category_idx"
ON "ClientDocument"("category");

CREATE INDEX IF NOT EXISTS "ClientDocument_created_at_idx"
ON "ClientDocument"("created_at");

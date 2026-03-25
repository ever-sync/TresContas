-- Allow global DRE mappings to use NULL client_id.
ALTER TABLE "DREMapping"
ALTER COLUMN "client_id" DROP NOT NULL;

CREATE TABLE "SupportTicketDocument" (
    "id" TEXT NOT NULL,
    "support_ticket_id" TEXT NOT NULL,
    "client_document_id" TEXT NOT NULL,
    "created_by_role" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicketDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicketDocument_support_ticket_id_client_document_id_key"
ON "SupportTicketDocument"("support_ticket_id", "client_document_id");

CREATE INDEX "SupportTicketDocument_support_ticket_id_idx"
ON "SupportTicketDocument"("support_ticket_id");

CREATE INDEX "SupportTicketDocument_client_document_id_idx"
ON "SupportTicketDocument"("client_document_id");

ALTER TABLE "SupportTicketDocument"
ADD CONSTRAINT "SupportTicketDocument_support_ticket_id_fkey"
FOREIGN KEY ("support_ticket_id") REFERENCES "SupportTicket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicketDocument"
ADD CONSTRAINT "SupportTicketDocument_client_document_id_fkey"
FOREIGN KEY ("client_document_id") REFERENCES "ClientDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

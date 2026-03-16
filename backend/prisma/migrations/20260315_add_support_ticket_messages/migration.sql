CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "support_ticket_id" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketMessage_support_ticket_id_idx" ON "SupportTicketMessage"("support_ticket_id");
CREATE INDEX "SupportTicketMessage_created_at_idx" ON "SupportTicketMessage"("created_at");

ALTER TABLE "SupportTicketMessage"
ADD CONSTRAINT "SupportTicketMessage_support_ticket_id_fkey"
FOREIGN KEY ("support_ticket_id") REFERENCES "SupportTicket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SupportTicketMessage" (
    "id",
    "support_ticket_id",
    "author_role",
    "author_name",
    "body",
    "created_at",
    "updated_at"
)
SELECT
    md5(st."id" || st."created_at"::text || random()::text),
    st."id",
    'client',
    COALESCE(NULLIF(c."representative_name", ''), c."name"),
    st."message",
    st."created_at",
    st."updated_at"
FROM "SupportTicket" st
INNER JOIN "Client" c ON c."id" = st."client_id";

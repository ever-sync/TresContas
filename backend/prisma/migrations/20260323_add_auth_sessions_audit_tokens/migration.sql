CREATE TABLE IF NOT EXISTS "AuthSession" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "user_id" TEXT,
    "client_id" TEXT,
    "accounting_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_session_id" TEXT,
    "last_used_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthSession_refresh_token_hash_key"
    ON "AuthSession"("refresh_token_hash");

CREATE INDEX IF NOT EXISTS "AuthSession_accounting_id_idx"
    ON "AuthSession"("accounting_id");

CREATE INDEX IF NOT EXISTS "AuthSession_user_id_idx"
    ON "AuthSession"("user_id");

CREATE INDEX IF NOT EXISTS "AuthSession_client_id_idx"
    ON "AuthSession"("client_id");

CREATE INDEX IF NOT EXISTS "AuthSession_subject_type_idx"
    ON "AuthSession"("subject_type");

CREATE INDEX IF NOT EXISTS "AuthSession_expires_at_idx"
    ON "AuthSession"("expires_at");

CREATE INDEX IF NOT EXISTS "AuthSession_revoked_at_idx"
    ON "AuthSession"("revoked_at");

CREATE INDEX IF NOT EXISTS "AuthSession_replaced_by_session_id_idx"
    ON "AuthSession"("replaced_by_session_id");

CREATE TABLE IF NOT EXISTS "AccountActionToken" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "accounting_id" TEXT,
    "user_id" TEXT,
    "client_id" TEXT,
    "email" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountActionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountActionToken_token_hash_key"
    ON "AccountActionToken"("token_hash");

CREATE INDEX IF NOT EXISTS "AccountActionToken_purpose_idx"
    ON "AccountActionToken"("purpose");

CREATE INDEX IF NOT EXISTS "AccountActionToken_subject_type_idx"
    ON "AccountActionToken"("subject_type");

CREATE INDEX IF NOT EXISTS "AccountActionToken_accounting_id_idx"
    ON "AccountActionToken"("accounting_id");

CREATE INDEX IF NOT EXISTS "AccountActionToken_user_id_idx"
    ON "AccountActionToken"("user_id");

CREATE INDEX IF NOT EXISTS "AccountActionToken_client_id_idx"
    ON "AccountActionToken"("client_id");

CREATE INDEX IF NOT EXISTS "AccountActionToken_email_idx"
    ON "AccountActionToken"("email");

CREATE INDEX IF NOT EXISTS "AccountActionToken_expires_at_idx"
    ON "AccountActionToken"("expires_at");

CREATE INDEX IF NOT EXISTS "AccountActionToken_used_at_idx"
    ON "AccountActionToken"("used_at");

CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL,
    "actor_type" TEXT,
    "actor_role" TEXT,
    "actor_id" TEXT,
    "accounting_id" TEXT,
    "client_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditEvent_actor_id_idx"
    ON "AuditEvent"("actor_id");

CREATE INDEX IF NOT EXISTS "AuditEvent_accounting_id_idx"
    ON "AuditEvent"("accounting_id");

CREATE INDEX IF NOT EXISTS "AuditEvent_client_id_idx"
    ON "AuditEvent"("client_id");

CREATE INDEX IF NOT EXISTS "AuditEvent_action_idx"
    ON "AuditEvent"("action");

CREATE INDEX IF NOT EXISTS "AuditEvent_entity_type_idx"
    ON "AuditEvent"("entity_type");

CREATE INDEX IF NOT EXISTS "AuditEvent_entity_id_idx"
    ON "AuditEvent"("entity_id");

CREATE INDEX IF NOT EXISTS "AuditEvent_created_at_idx"
    ON "AuditEvent"("created_at");

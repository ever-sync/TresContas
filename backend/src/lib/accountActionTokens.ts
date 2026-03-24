import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { createRefreshToken, hashToken } from './authTokens';
import { securityConfig } from '../config/security';
import type { AuthAudience } from './authCookies';

export type AccountActionPurpose =
    | 'forgot_password'
    | 'reset_password'
    | 'invite'
    | 'accept_invite';

export interface AccountActionTokenInput {
    purpose: AccountActionPurpose;
    subjectType: AuthAudience;
    accountingId?: string | null;
    userId?: string | null;
    clientId?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown> | null;
    request?: Request;
}

export interface AccountActionTokenRecord {
    id: string;
    purpose: string;
    subject_type: string;
    accounting_id: string | null;
    user_id: string | null;
    client_id: string | null;
    email: string | null;
    token_hash: string;
    expires_at: Date;
    used_at: Date | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

export interface AccountActionTokenBundle {
    token: string;
    expiresAt: Date;
    id: string;
}

const getIpAddress = (request?: Request) => {
    const forwarded = typeof request?.headers['x-forwarded-for'] === 'string'
        ? request.headers['x-forwarded-for'].split(',')[0]?.trim()
        : null;

    return forwarded || request?.ip || request?.socket?.remoteAddress || null;
};

export const createAccountActionToken = async (
    input: AccountActionTokenInput
): Promise<AccountActionTokenBundle> => {
    const token = createRefreshToken();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + securityConfig.accountActionTtlMs);

    await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "AccountActionToken" (
            id,
            purpose,
            subject_type,
            accounting_id,
            user_id,
            client_id,
            email,
            token_hash,
            expires_at,
            used_at,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            ${id},
            ${input.purpose},
            ${input.subjectType},
            ${input.accountingId || null},
            ${input.userId || null},
            ${input.clientId || null},
            ${input.email || null},
            ${hashToken(token)},
            ${expiresAt},
            NULL,
            CAST(${JSON.stringify(input.metadata || {})} AS jsonb),
            NOW(),
            NOW()
        )
    `);

    return { token, expiresAt, id };
};

const selectToken = async (whereSql: Prisma.Sql) => {
    const tokens = await prisma.$queryRaw<AccountActionTokenRecord[]>(Prisma.sql`
        SELECT
            id,
            purpose,
            subject_type,
            accounting_id,
            user_id,
            client_id,
            email,
            token_hash,
            expires_at,
            used_at,
            metadata,
            created_at,
            updated_at
        FROM "AccountActionToken"
        ${whereSql}
        LIMIT 1
    `);

    return tokens[0] || null;
};

export const findAccountActionTokenByToken = async (token: string) =>
    selectToken(Prisma.sql`WHERE token_hash = ${hashToken(token)}`);

export const consumeAccountActionToken = async (token: string) => {
    const existingToken = await findAccountActionTokenByToken(token);
    if (!existingToken || existingToken.used_at || existingToken.expires_at <= new Date()) {
        return null;
    }

    const now = new Date();
    await prisma.$executeRaw(Prisma.sql`
        UPDATE "AccountActionToken"
        SET used_at = ${now},
            updated_at = ${now}
        WHERE id = ${existingToken.id}
    `);

    return existingToken;
};

export const revokeAccountActionTokensByUserId = async (userId: string) => {
    const now = new Date();

    await prisma.$executeRaw(Prisma.sql`
        UPDATE "AccountActionToken"
        SET used_at = ${now},
            updated_at = ${now}
        WHERE user_id = ${userId}
          AND used_at IS NULL
    `);
};

export const revokeAccountActionTokensByClientId = async (clientId: string) => {
    const now = new Date();

    await prisma.$executeRaw(Prisma.sql`
        UPDATE "AccountActionToken"
        SET used_at = ${now},
            updated_at = ${now}
        WHERE client_id = ${clientId}
          AND used_at IS NULL
    `);
};

export const buildActionTokenLink = (path: string, token: string) => {
    const origin = process.env.FRONTEND_URL?.trim() || process.env.VITE_API_URL?.replace(/\/api\/?$/, '')?.trim();
    if (!origin) {
        return null;
    }

    return `${origin.replace(/\/$/, '')}${path}?token=${encodeURIComponent(token)}`;
};


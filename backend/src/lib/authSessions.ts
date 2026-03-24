import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { securityConfig } from '../config/security';
import { createRefreshToken, getTokenExpiryIsoString, hashToken, signAccessToken, type AuthRole } from './authTokens';
import type { AuthAudience } from './authCookies';

export interface AuthSessionInput {
    subjectType: AuthAudience;
    role: AuthRole;
    accountingId: string;
    userId?: string;
    clientId?: string;
    request?: Request;
}

export interface AuthSessionBundle {
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: string;
    sessionId: string;
}

export interface AuthSessionRecord {
    id: string;
    subject_type: string;
    role: string;
    user_id: string | null;
    client_id: string | null;
    accounting_id: string;
    refresh_token_hash: string;
    expires_at: Date;
    revoked_at: Date | null;
    replaced_by_session_id: string | null;
    last_used_at: Date | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
    updated_at: Date;
}

const getIpAddress = (request?: Request) => {
    const forwarded = typeof request?.headers['x-forwarded-for'] === 'string'
        ? request.headers['x-forwarded-for'].split(',')[0]?.trim()
        : null;

    return forwarded || request?.ip || request?.socket?.remoteAddress || null;
};

const sessionColumns = Prisma.sql`
    id,
    subject_type,
    role,
    user_id,
    client_id,
    accounting_id,
    refresh_token_hash,
    expires_at,
    revoked_at,
    replaced_by_session_id,
    last_used_at,
    ip_address,
    user_agent,
    created_at,
    updated_at
`;

const selectSessionByColumn = async (
    column: 'id' | 'refresh_token_hash',
    value: string
) => {
    const sessions = await prisma.$queryRaw<AuthSessionRecord[]>(Prisma.sql`
        SELECT ${sessionColumns}
        FROM "AuthSession"
        WHERE ${Prisma.raw(column)} = ${value}
        LIMIT 1
    `);

    return sessions[0] || null;
};

export const createAuthSession = async (input: AuthSessionInput): Promise<AuthSessionBundle> => {
    const refreshToken = createRefreshToken();
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(Date.now() + securityConfig.authRefreshTtlMs);

    await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "AuthSession" (
            id,
            subject_type,
            role,
            user_id,
            client_id,
            accounting_id,
            refresh_token_hash,
            expires_at,
            revoked_at,
            replaced_by_session_id,
            last_used_at,
            ip_address,
            user_agent,
            created_at,
            updated_at
        ) VALUES (
            ${sessionId},
            ${input.subjectType},
            ${input.role},
            ${input.userId || null},
            ${input.clientId || null},
            ${input.accountingId},
            ${hashToken(refreshToken)},
            ${expiresAt},
            NULL,
            NULL,
            ${now},
            ${getIpAddress(input.request)},
            ${typeof input.request?.headers['user-agent'] === 'string' ? input.request.headers['user-agent'] : null},
            ${now},
            ${now}
        )
    `);

    const accessToken = signAccessToken({
        sessionId,
        subjectType: input.subjectType,
        role: input.role,
        userId: input.userId,
        clientId: input.clientId,
        accountingId: input.accountingId,
    });

    return {
        accessToken,
        refreshToken,
        accessExpiresAt: getTokenExpiryIsoString(accessToken),
        sessionId,
    };
};

export const findSessionByRefreshToken = async (refreshToken: string) => {
    return selectSessionByColumn('refresh_token_hash', hashToken(refreshToken));
};

export const findSessionById = async (sessionId: string) => {
    return selectSessionByColumn('id', sessionId);
};

export const rotateAuthSession = async (input: AuthSessionInput & { refreshToken: string }) => {
    const existingSession = await findSessionByRefreshToken(input.refreshToken);
    if (!existingSession || existingSession.revoked_at || existingSession.expires_at <= new Date()) {
        return null;
    }

    if (existingSession.subject_type !== input.subjectType) {
        return null;
    }

    const nextRefreshToken = createRefreshToken();
    const nextSessionId = randomUUID();
    const now = new Date();
    const nextExpiresAt = new Date(Date.now() + securityConfig.authRefreshTtlMs);

    await prisma.$transaction([
        prisma.$executeRaw(Prisma.sql`
            INSERT INTO "AuthSession" (
                id,
                subject_type,
                role,
                user_id,
                client_id,
                accounting_id,
                refresh_token_hash,
                expires_at,
                revoked_at,
                replaced_by_session_id,
                last_used_at,
                ip_address,
                user_agent,
                created_at,
                updated_at
            ) VALUES (
                ${nextSessionId},
                ${input.subjectType},
                ${input.role},
                ${input.userId || null},
                ${input.clientId || null},
                ${input.accountingId},
                ${hashToken(nextRefreshToken)},
                ${nextExpiresAt},
                NULL,
                NULL,
                ${now},
                ${getIpAddress(input.request)},
                ${typeof input.request?.headers['user-agent'] === 'string' ? input.request.headers['user-agent'] : null},
                ${now},
                ${now}
            )
        `),
        prisma.$executeRaw(Prisma.sql`
            UPDATE "AuthSession"
            SET revoked_at = ${now},
                replaced_by_session_id = ${nextSessionId},
                last_used_at = ${now},
                updated_at = ${now}
            WHERE id = ${existingSession.id}
        `),
    ]);

    const accessToken = signAccessToken({
        sessionId: nextSessionId,
        subjectType: input.subjectType,
        role: input.role,
        userId: input.userId,
        clientId: input.clientId,
        accountingId: input.accountingId,
    });

    return {
        accessToken,
        refreshToken: nextRefreshToken,
        accessExpiresAt: getTokenExpiryIsoString(accessToken),
        sessionId: nextSessionId,
    };
};

export const revokeAuthSessionById = async (sessionId: string) => {
    const now = new Date();

    await prisma.$executeRaw(Prisma.sql`
        UPDATE "AuthSession"
        SET revoked_at = ${now},
            updated_at = ${now}
        WHERE id = ${sessionId}
          AND revoked_at IS NULL
    `);
};

export const revokeAuthSessionByRefreshToken = async (refreshToken: string) => {
    const session = await findSessionByRefreshToken(refreshToken);
    if (!session) {
        return;
    }

    await revokeAuthSessionById(session.id);
};

export const revokeAuthSessionsByUserId = async (userId: string) => {
    const now = new Date();

    await prisma.$executeRaw(Prisma.sql`
        UPDATE "AuthSession"
        SET revoked_at = ${now},
            updated_at = ${now}
        WHERE user_id = ${userId}
          AND revoked_at IS NULL
    `);
};

export const revokeAuthSessionsByClientId = async (clientId: string) => {
    const now = new Date();

    await prisma.$executeRaw(Prisma.sql`
        UPDATE "AuthSession"
        SET revoked_at = ${now},
            updated_at = ${now}
        WHERE client_id = ${clientId}
          AND revoked_at IS NULL
    `);
};

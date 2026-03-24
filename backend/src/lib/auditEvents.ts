import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from './prisma';

export interface AuditEventInput {
    actorType?: string | null;
    actorRole?: string | null;
    actorId?: string | null;
    accountingId?: string | null;
    clientId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
    requestId?: string | null;
    request?: Request;
}

export interface AuditEventRecord {
    id: string;
    actor_type: string | null;
    actor_role: string | null;
    actor_id: string | null;
    accounting_id: string | null;
    client_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    request_id: string | null;
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

export const recordAuditEvent = async (input: AuditEventInput) => {
    await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "AuditEvent" (
            id,
            actor_type,
            actor_role,
            actor_id,
            accounting_id,
            client_id,
            action,
            entity_type,
            entity_id,
            metadata,
            request_id,
            ip_address,
            user_agent,
            created_at,
            updated_at
        ) VALUES (
            ${randomUUID()},
            ${input.actorType || null},
            ${input.actorRole || null},
            ${input.actorId || null},
            ${input.accountingId || null},
            ${input.clientId || null},
            ${input.action},
            ${input.entityType},
            ${input.entityId || null},
            CAST(${JSON.stringify(input.metadata || {})} AS jsonb),
            ${input.requestId || null},
            ${getIpAddress(input.request)},
            ${typeof input.request?.headers['user-agent'] === 'string' ? input.request.headers['user-agent'] : null},
            NOW(),
            NOW()
        )
    `);
};

export interface AuditEventQuery {
    accountingId?: string | null;
    actorId?: string | null;
    clientId?: string | null;
    action?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    from?: Date | null;
    to?: Date | null;
    limit?: number;
    offset?: number;
}

export const listAuditEvents = async (query: AuditEventQuery = {}) => {
    const filters: Prisma.Sql[] = [];

    if (query.accountingId) filters.push(Prisma.sql`accounting_id = ${query.accountingId}`);
    if (query.actorId) filters.push(Prisma.sql`actor_id = ${query.actorId}`);
    if (query.clientId) filters.push(Prisma.sql`client_id = ${query.clientId}`);
    if (query.action) filters.push(Prisma.sql`action = ${query.action}`);
    if (query.entityType) filters.push(Prisma.sql`entity_type = ${query.entityType}`);
    if (query.entityId) filters.push(Prisma.sql`entity_id = ${query.entityId}`);
    if (query.from) filters.push(Prisma.sql`created_at >= ${query.from}`);
    if (query.to) filters.push(Prisma.sql`created_at <= ${query.to}`);

    const whereClause = filters.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
        : Prisma.empty;

    const limit = Math.max(1, Math.min(query.limit || 100, 500));
    const offset = Math.max(0, query.offset || 0);

    return prisma.$queryRaw<AuditEventRecord[]>(Prisma.sql`
        SELECT
            id,
            actor_type,
            actor_role,
            actor_id,
            accounting_id,
            client_id,
            action,
            entity_type,
            entity_id,
            metadata,
            request_id,
            ip_address,
            user_agent,
            created_at,
            updated_at
        FROM "AuditEvent"
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
    `);
};

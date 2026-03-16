import { randomUUID } from 'crypto';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;

const isValidPriority = (value: string) =>
    ['low', 'medium', 'high'].includes(value);

const isValidStatus = (value: string) =>
    ['open', 'in_progress', 'closed'].includes(value);

type SupportTicketMessageRow = {
    id: string;
    support_ticket_id: string;
    author_role: string;
    author_name: string;
    body: string;
    created_at: Date;
    updated_at: Date;
};

type SupportTicketDocumentRow = {
    id: string;
    support_ticket_id: string;
    client_document_id: string;
    created_by_role: string;
    created_by_name: string;
    created_at: Date;
    updated_at: Date;
    document_id: string;
    original_name: string;
    display_name: string;
    category: string;
    mime_type: string;
    size_bytes: number;
};

const ticketSelect = {
    id: true,
    subject: true,
    message: true,
    priority: true,
    status: true,
    created_at: true,
    updated_at: true,
    closed_at: true,
    client: {
        select: {
            id: true,
            name: true,
            cnpj: true,
            industry: true,
        },
    },
};

const mapMessage = (message: SupportTicketMessageRow) => ({
    id: message.id,
    support_ticket_id: message.support_ticket_id,
    author_role: message.author_role,
    author_name: message.author_name,
    body: message.body,
    created_at: message.created_at,
    updated_at: message.updated_at,
});

const mapDocument = (document: SupportTicketDocumentRow) => ({
    id: document.id,
    support_ticket_id: document.support_ticket_id,
    client_document_id: document.client_document_id,
    created_by_role: document.created_by_role,
    created_by_name: document.created_by_name,
    created_at: document.created_at,
    updated_at: document.updated_at,
    document: {
        id: document.document_id,
        original_name: document.original_name,
        display_name: document.display_name,
        category: document.category,
        mime_type: document.mime_type,
        size_bytes: document.size_bytes,
    },
});

const getStaffAuthorName = async (userId?: string, accountingId?: string) => {
    if (!userId || !accountingId) return 'Contabilidade';

    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            accounting_id: accountingId,
        },
        select: { name: true },
    });

    return user?.name || 'Contabilidade';
};

const getSupportTicketForStaff = async (id: string, accountingId: string) =>
    prisma.supportTicket.findFirst({
        where: { id, accounting_id: accountingId },
        select: ticketSelect,
    });

export const listSupportTickets = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const status = isNonEmptyString(req.query?.status)
            ? String(req.query.status)
            : undefined;

        const where = {
            accounting_id: req.accountingId,
            ...(status && isValidStatus(status) ? { status } : {}),
        };

        const tickets = await prisma.supportTicket.findMany({
            where,
            orderBy: { updated_at: 'desc' },
            select: ticketSelect,
        });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar chamados' });
    }
};

export const createSupportTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const client_id = isNonEmptyString(req.body?.client_id) ? req.body.client_id.trim() : '';
        const subject = isNonEmptyString(req.body?.subject) ? req.body.subject.trim() : '';
        const message = isNonEmptyString(req.body?.message) ? req.body.message.trim() : '';
        const priority = isNonEmptyString(req.body?.priority) ? req.body.priority.trim() : 'medium';

        if (!client_id || !subject || !message) {
            return res.status(400).json({ message: 'Cliente, assunto e descrição são obrigatórios' });
        }

        if (!isValidPriority(priority)) {
            return res.status(400).json({ message: 'Prioridade inválida' });
        }

        const client = await prisma.client.findFirst({
            where: {
                id: client_id,
                accounting_id: req.accountingId,
            },
            select: {
                id: true,
                name: true,
                representative_name: true,
            },
        });

        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const authorName = await getStaffAuthorName(req.userId, req.accountingId);

        const ticket = await prisma.$transaction(async (tx) => {
            const createdTicket = await tx.supportTicket.create({
                data: {
                    accounting_id: req.accountingId!,
                    client_id,
                    subject,
                    message,
                    priority,
                    status: 'open',
                },
                select: ticketSelect,
            });

            await tx.$executeRaw(Prisma.sql`
                INSERT INTO "SupportTicketMessage" (
                    id,
                    support_ticket_id,
                    author_role,
                    author_name,
                    body,
                    created_at,
                    updated_at
                )
                VALUES (
                    ${randomUUID()},
                    ${createdTicket.id},
                    'staff',
                    ${authorName || client.representative_name || client.name},
                    ${message},
                    NOW(),
                    NOW()
                )
            `);

            return createdTicket;
        });

        res.status(201).json(ticket);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return res.status(400).json({ message: 'Erro ao criar chamado' });
        }
        res.status(500).json({ message: 'Erro ao criar chamado' });
    }
};

export const updateSupportTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const { id } = req.params;
        const status = isNonEmptyString(req.body?.status) ? req.body.status.trim() : '';

        if (!isValidStatus(status)) {
            return res.status(400).json({ message: 'Status inválido' });
        }

        const existing = await getSupportTicketForStaff(String(id), req.accountingId);

        if (!existing) {
            return res.status(404).json({ message: 'Chamado não encontrado' });
        }

        const ticket = await prisma.supportTicket.update({
            where: { id: String(id) },
            data: {
                status,
                closed_at: status === 'closed' ? new Date() : null,
                updated_at: new Date(),
            },
            select: ticketSelect,
        });

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar chamado' });
    }
};

export const listSupportTicketMessages = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const ticketId = String(req.params.id);
        const ticket = await getSupportTicketForStaff(ticketId, req.accountingId);
        if (!ticket) {
            return res.status(404).json({ message: 'Chamado nao encontrado' });
        }

        const messages = await prisma.$queryRaw<SupportTicketMessageRow[]>(Prisma.sql`
            SELECT
                id,
                support_ticket_id,
                author_role,
                author_name,
                body,
                created_at,
                updated_at
            FROM "SupportTicketMessage"
            WHERE support_ticket_id = ${ticketId}
            ORDER BY created_at ASC
        `);

        res.json(messages.map(mapMessage));
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar mensagens do chamado' });
    }
};

export const createSupportTicketMessage = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const ticketId = String(req.params.id);
        const body = isNonEmptyString(req.body?.body) ? req.body.body.trim() : '';
        if (!body) {
            return res.status(400).json({ message: 'Mensagem obrigatoria' });
        }

        const ticket = await getSupportTicketForStaff(ticketId, req.accountingId);
        if (!ticket) {
            return res.status(404).json({ message: 'Chamado nao encontrado' });
        }

        const authorName = await getStaffAuthorName(req.userId, req.accountingId);
        const nextStatus = ticket.status === 'closed' ? 'in_progress' : ticket.status === 'open' ? 'in_progress' : ticket.status;

        const [messageRows] = await prisma.$transaction([
            prisma.$queryRaw<SupportTicketMessageRow[]>(Prisma.sql`
                INSERT INTO "SupportTicketMessage" (
                    id,
                    support_ticket_id,
                    author_role,
                    author_name,
                    body,
                    created_at,
                    updated_at
                )
                VALUES (
                    ${randomUUID()},
                    ${ticketId},
                    'staff',
                    ${authorName},
                    ${body},
                    NOW(),
                    NOW()
                )
                RETURNING
                    id,
                    support_ticket_id,
                    author_role,
                    author_name,
                    body,
                    created_at,
                    updated_at
            `),
            prisma.supportTicket.update({
                where: { id: ticketId },
                data: {
                    status: nextStatus,
                    closed_at: nextStatus === 'closed' ? ticket.closed_at : null,
                    updated_at: new Date(),
                },
                select: { id: true },
            }),
        ]);

        res.status(201).json(mapMessage(messageRows[0]));
    } catch (error) {
        res.status(500).json({ message: 'Erro ao responder chamado' });
    }
};

export const listSupportTicketDocuments = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const ticketId = String(req.params.id);
        const ticket = await getSupportTicketForStaff(ticketId, req.accountingId);
        if (!ticket) {
            return res.status(404).json({ message: 'Chamado nao encontrado' });
        }

        const documents = await prisma.$queryRaw<SupportTicketDocumentRow[]>(Prisma.sql`
            SELECT
                std.id,
                std.support_ticket_id,
                std.client_document_id,
                std.created_by_role,
                std.created_by_name,
                std.created_at,
                std.updated_at,
                cd.id AS document_id,
                cd.original_name,
                cd.display_name,
                cd.category,
                cd.mime_type,
                cd.size_bytes
            FROM "SupportTicketDocument" std
            INNER JOIN "ClientDocument" cd ON cd.id = std.client_document_id
            WHERE std.support_ticket_id = ${ticketId}
            ORDER BY std.created_at ASC
        `);

        res.json(documents.map(mapDocument));
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar anexos do chamado' });
    }
};

export const createSupportTicketDocument = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const ticketId = String(req.params.id);
        const clientDocumentId = isNonEmptyString(req.body?.client_document_id)
            ? req.body.client_document_id.trim()
            : '';

        if (!clientDocumentId) {
            return res.status(400).json({ message: 'Documento obrigatorio' });
        }

        const ticket = await getSupportTicketForStaff(ticketId, req.accountingId);
        if (!ticket) {
            return res.status(404).json({ message: 'Chamado nao encontrado' });
        }

        const documents = await prisma.$queryRaw<Array<{
            id: string;
            client_id: string;
            display_name: string;
        }>>(Prisma.sql`
            SELECT id, client_id, display_name
            FROM "ClientDocument"
            WHERE id = ${clientDocumentId}
              AND accounting_id = ${req.accountingId}
              AND client_id = ${ticket.client.id}
            LIMIT 1
        `);
        const document = documents[0];

        if (!document) {
            return res.status(404).json({ message: 'Documento nao encontrado para este cliente' });
        }

        const authorName = await getStaffAuthorName(req.userId, req.accountingId);
        const nextStatus = ticket.status === 'closed' ? 'in_progress' : ticket.status === 'open' ? 'in_progress' : ticket.status;
        const note = `Anexou o arquivo "${document.display_name}" ao chamado.`;

        const [attachedRows] = await prisma.$transaction([
            prisma.$queryRaw<SupportTicketDocumentRow[]>(Prisma.sql`
                INSERT INTO "SupportTicketDocument" (
                    id,
                    support_ticket_id,
                    client_document_id,
                    created_by_role,
                    created_by_name,
                    created_at,
                    updated_at
                )
                VALUES (
                    ${randomUUID()},
                    ${ticketId},
                    ${clientDocumentId},
                    'staff',
                    ${authorName},
                    NOW(),
                    NOW()
                )
                RETURNING
                    id,
                    support_ticket_id,
                    client_document_id,
                    created_by_role,
                    created_by_name,
                    created_at,
                    updated_at,
                    ${clientDocumentId}::text AS document_id,
                    ''::text AS original_name,
                    ${document.display_name}::text AS display_name,
                    ''::text AS category,
                    ''::text AS mime_type,
                    0::int AS size_bytes
            `),
            prisma.$executeRaw(Prisma.sql`
                INSERT INTO "SupportTicketMessage" (
                    id,
                    support_ticket_id,
                    author_role,
                    author_name,
                    body,
                    created_at,
                    updated_at
                )
                VALUES (
                    ${randomUUID()},
                    ${ticketId},
                    'staff',
                    ${authorName},
                    ${note},
                    NOW(),
                    NOW()
                )
            `),
            prisma.supportTicket.update({
                where: { id: ticketId },
                data: {
                    status: nextStatus,
                    closed_at: nextStatus === 'closed' ? ticket.closed_at : null,
                    updated_at: new Date(),
                },
                select: { id: true },
            }),
        ]);

        const attached = attachedRows[0];
        const hydrated = await prisma.$queryRaw<SupportTicketDocumentRow[]>(Prisma.sql`
            SELECT
                std.id,
                std.support_ticket_id,
                std.client_document_id,
                std.created_by_role,
                std.created_by_name,
                std.created_at,
                std.updated_at,
                cd.id AS document_id,
                cd.original_name,
                cd.display_name,
                cd.category,
                cd.mime_type,
                cd.size_bytes
            FROM "SupportTicketDocument" std
            INNER JOIN "ClientDocument" cd ON cd.id = std.client_document_id
            WHERE std.id = ${attached.id}
            LIMIT 1
        `);

        res.status(201).json(mapDocument(hydrated[0]));
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ message: 'Este documento ja esta anexado ao chamado' });
        }
        res.status(500).json({ message: 'Erro ao anexar documento ao chamado' });
    }
};

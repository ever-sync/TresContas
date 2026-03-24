import { randomUUID } from 'crypto';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;

const isValidPriority = (value: string) =>
    ['low', 'medium', 'high'].includes(value);

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

const clientSelect = {
    id: true,
    name: true,
    cnpj: true,
    email: true,
    phone: true,
    industry: true,
    address: true,
    status: true,
    tax_regime: true,
    representative_email: true,
    representative_name: true,
    accounting_id: true,
    created_at: true,
    updated_at: true,
};

const supportTicketSelect = {
    id: true,
    subject: true,
    message: true,
    priority: true,
    status: true,
    created_at: true,
    updated_at: true,
    closed_at: true,
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

const getClientAuthorName = async (clientId: string) => {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
            name: true,
            representative_name: true,
        },
    });

    return client?.representative_name?.trim() || client?.name || 'Cliente';
};

const getSupportTicketForClient = async (id: string, clientId: string) =>
    prisma.supportTicket.findFirst({
        where: { id, client_id: clientId },
        select: supportTicketSelect,
    });

export const getClientProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const client = await prisma.client.findUnique({
            where: { id: req.clientId },
            select: clientSelect,
        });

        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        res.json(client);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar dados do cliente' });
    }
};

export const getClientSupportTickets = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const tickets = await prisma.supportTicket.findMany({
            where: { client_id: req.clientId },
            orderBy: { updated_at: 'desc' },
            select: supportTicketSelect,
        });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar chamados' });
    }
};

export const createClientSupportTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId || !req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const subject = isNonEmptyString(req.body?.subject) ? req.body.subject.trim() : '';
        const message = isNonEmptyString(req.body?.message) ? req.body.message.trim() : '';
        const priority = isNonEmptyString(req.body?.priority) ? req.body.priority.trim() : 'medium';

        if (!subject || !message) {
            return res.status(400).json({ message: 'Assunto e descrição são obrigatórios' });
        }

        if (!isValidPriority(priority)) {
            return res.status(400).json({ message: 'Prioridade inválida' });
        }

        const authorName = await getClientAuthorName(req.clientId);

        const ticket = await prisma.$transaction(async (tx) => {
            const createdTicket = await tx.supportTicket.create({
                data: {
                    accounting_id: req.accountingId!,
                    client_id: req.clientId!,
                    subject,
                    message,
                    priority,
                    status: 'open',
                },
                select: supportTicketSelect,
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
                    'client',
                    ${authorName},
                    ${message},
                    NOW(),
                    NOW()
                )
            `);

            return createdTicket;
        });

        res.status(201).json(ticket);
    } catch (error) {
        console.error('Error creating client support ticket:', error);
        res.status(500).json({ message: 'Erro ao criar chamado' });
    }
};

export const getClientSupportTicketMessages = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const ticketId = String(req.params.id);
        const ticket = await getSupportTicketForClient(ticketId, req.clientId);
        if (!ticket) {
            return res.status(404).json({ message: 'Chamado não encontrado' });
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

export const createClientSupportTicketMessage = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const ticketId = String(req.params.id);
        const body = isNonEmptyString(req.body?.body) ? req.body.body.trim() : '';
        if (!body) {
            return res.status(400).json({ message: 'Mensagem obrigatória' });
        }

        const ticket = await getSupportTicketForClient(ticketId, req.clientId);
        if (!ticket) {
            return res.status(404).json({ message: 'Chamado não encontrado' });
        }

        const authorName = await getClientAuthorName(req.clientId);
        const nextStatus = ticket.status === 'closed' ? 'open' : ticket.status;

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
                    'client',
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
        res.status(500).json({ message: 'Erro ao enviar mensagem' });
    }
};

export const getClientMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const type = req.query.type as string | undefined;

        const whereClause: Record<string, unknown> = { client_id: req.clientId, year };
        if (type && ['dre', 'patrimonial'].includes(type)) {
            whereClause.type = type;
        }

        const movements = await prisma.monthlyMovement.findMany({
            where: whereClause,
            orderBy: { code: 'asc' },
            select: {
                id: true,
                code: true,
                reduced_code: true,
                name: true,
                level: true,
                type: true,
                category: true,
                values: true,
            },
        });

        res.json(movements);
    } catch (error) {
        console.error('Erro ao buscar movimentações do cliente:', error);
        res.status(500).json({ message: 'Erro ao buscar movimentações' });
    }
};

export const getClientChartOfAccounts = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId || !req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const accounts = await prisma.chartOfAccounts.findMany({
            where: { accounting_id: req.accountingId },
            orderBy: { code: 'asc' },
            select: {
                id: true,
                code: true,
                reduced_code: true,
                name: true,
                level: true,
                type: true,
                alias: true,
                report_type: true,
                report_category: true,
                is_analytic: true,
            },
        });

        res.json(accounts);
    } catch (error) {
        console.error('Erro ao buscar plano de contas compartilhado:', error);
        res.status(500).json({ message: 'Erro ao buscar plano de contas' });
    }
};

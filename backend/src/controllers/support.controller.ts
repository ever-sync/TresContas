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
            orderBy: { created_at: 'desc' },
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
            select: { id: true },
        });

        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                accounting_id: req.accountingId,
                client_id,
                subject,
                message,
                priority,
                status: 'open',
            },
            select: ticketSelect,
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

        const existing = await prisma.supportTicket.findFirst({
            where: { id: String(id), accounting_id: req.accountingId },
            select: { id: true },
        });

        if (!existing) {
            return res.status(404).json({ message: 'Chamado não encontrado' });
        }

        const ticket = await prisma.supportTicket.update({
            where: { id: String(id) },
            data: {
                status,
                closed_at: status === 'closed' ? new Date() : null,
            },
            select: ticketSelect,
        });

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar chamado' });
    }
};

import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;

const isValidPriority = (value: string) =>
    ['low', 'medium', 'high'].includes(value);

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

/**
 * Get support tickets for the authenticated client.
 */
export const getClientSupportTickets = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const tickets = await prisma.supportTicket.findMany({
            where: { client_id: req.clientId },
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                subject: true,
                message: true,
                priority: true,
                status: true,
                created_at: true,
                updated_at: true,
                closed_at: true,
            },
        });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar chamados' });
    }
};

/**
 * Create a support ticket as the authenticated client.
 */
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

        const ticket = await prisma.supportTicket.create({
            data: {
                accounting_id: req.accountingId,
                client_id: req.clientId,
                subject,
                message,
                priority,
                status: 'open',
            },
            select: {
                id: true,
                subject: true,
                message: true,
                priority: true,
                status: true,
                created_at: true,
            },
        });

        res.status(201).json(ticket);
    } catch (error) {
        console.error('Error creating client support ticket:', error);
        res.status(500).json({ message: 'Erro ao criar chamado' });
    }
};

/**
 * GET /api/client-portal/movements?year=2025&type=dre|patrimonial
 * Retorna movimentações do cliente autenticado (leitura própria).
 */
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

/**
 * Get chart of accounts for the authenticated client.
 */
export const getClientChartOfAccounts = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const accounts = await prisma.chartOfAccounts.findMany({
            where: { client_id: req.clientId },
            orderBy: { code: 'asc' },
            select: {
                id: true,
                code: true,
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
        console.error('Erro ao buscar plano de contas do cliente:', error);
        res.status(500).json({ message: 'Erro ao buscar plano de contas' });
    }
};

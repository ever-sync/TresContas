import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

const accountSelect = {
    id: true,
    code: true,
    name: true,
    level: true,
    type: true,
    alias: true,
    report_type: true,
    report_category: true,
    parent_id: true,
    is_analytic: true,
    created_at: true,
};

/**
 * Verify that the client belongs to the authenticated accounting firm.
 */
const verifyClientOwnership = async (clientId: string, accountingId: string) => {
    const client = await prisma.client.findFirst({
        where: { id: clientId, accounting_id: accountingId },
        select: { id: true },
    });
    return client !== null;
};

/**
 * GET /api/clients/:clientId/chart-of-accounts
 */
export const getAll = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const accounts = await prisma.chartOfAccounts.findMany({
            where: { client_id: clientId },
            orderBy: { code: 'asc' },
            select: accountSelect,
        });

        res.json(accounts);
    } catch (error: any) {
        console.error('Erro ao buscar plano de contas:', error);
        res.status(500).json({
            message: 'Erro ao buscar plano de contas',
            detail: error?.message || String(error),
            code: error?.code,
            meta: error?.meta,
        });
    }
};

/**
 * POST /api/clients/:clientId/chart-of-accounts
 */
export const create = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const { code, name, level, type, alias, report_type, report_category, parent_id } = req.body;

        if (!code || !name) {
            return res.status(400).json({ message: 'Código e nome são obrigatórios' });
        }

        const account = await prisma.chartOfAccounts.create({
            data: {
                accounting_id: req.accountingId,
                client_id: clientId,
                code: code.trim(),
                name: name.trim(),
                level: level || 1,
                type: type || 'A',
                alias: alias?.trim() || null,
                report_type: report_type?.trim() || null,
                report_category: report_category?.trim() || null,
                parent_id: parent_id || null,
                is_analytic: type !== 'T',
            },
            select: accountSelect,
        });

        res.status(201).json(account);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(400).json({ message: 'Código de conta já existe para este cliente' });
        }
        console.error('Erro ao criar conta:', error);
        res.status(500).json({ message: 'Erro ao criar conta' });
    }
};

/**
 * POST /api/clients/:clientId/chart-of-accounts/import
 * Importação em massa: substitui todo o plano de contas do cliente.
 */
export const bulkImport = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const { accounts } = req.body;

        if (!Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ message: 'Lista de contas é obrigatória' });
        }

        // Validação básica
        for (const acc of accounts) {
            if (!acc.code || !acc.name) {
                return res.status(400).json({ message: `Conta inválida: código e nome obrigatórios (código: ${acc.code || 'vazio'})` });
            }
        }

        // Sem transação para compatibilidade com pgBouncer
        // Passo 1: deletar plano anterior
        await prisma.chartOfAccounts.deleteMany({
            where: {
                client_id: clientId,
                ...(req.accountingId ? { accounting_id: req.accountingId } : {}),
            },
        });

        // Passo 2: inserir novo plano em lotes de 100
        const batchSize = 100;
        let totalCreated = 0;

        for (let i = 0; i < accounts.length; i += batchSize) {
            const batch = accounts.slice(i, i + batchSize);
            const created = await prisma.chartOfAccounts.createMany({
                data: batch.map((acc: any) => ({
                    accounting_id: req.accountingId!,
                    client_id: clientId,
                    code: String(acc.code).trim(),
                    name: String(acc.name).trim(),
                    level: parseInt(acc.level) || 1,
                    type: String(acc.type || 'A').trim(),
                    alias: acc.alias ? String(acc.alias).trim() : null,
                    report_type: acc.report_type ? String(acc.report_type).trim() : null,
                    report_category: acc.report_category ? String(acc.report_category).trim() : null,
                    parent_id: null,
                    is_analytic: String(acc.type || 'A').trim() !== 'T',
                })),
                skipDuplicates: true,
            });
            totalCreated += created.count;
        }

        res.json({
            message: `Plano de contas importado com sucesso`,
            count: totalCreated,
        });
    } catch (error: any) {
        console.error('Erro ao importar plano de contas:', error);
        res.status(500).json({
            message: 'Erro ao importar plano de contas',
            detail: error?.message || String(error),
            code: error?.code,
            meta: error?.meta,
        });
    }
};

/**
 * DELETE /api/clients/:clientId/chart-of-accounts/:id
 */
export const remove = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const clientId = String(req.params.clientId);
        const id = String(req.params.id);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const deleted = await prisma.chartOfAccounts.deleteMany({
            where: { id, client_id: clientId },
        });

        if (deleted.count === 0) {
            return res.status(404).json({ message: 'Conta não encontrada' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        res.status(500).json({ message: 'Erro ao excluir conta' });
    }
};

/**
 * DELETE /api/clients/:clientId/chart-of-accounts
 */
export const removeAll = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const deleted = await prisma.chartOfAccounts.deleteMany({
            where: { client_id: clientId },
        });

        res.json({ message: 'Plano de contas removido', count: deleted.count });
    } catch (error) {
        console.error('Erro ao limpar plano de contas:', error);
        res.status(500).json({ message: 'Erro ao limpar plano de contas' });
    }
};

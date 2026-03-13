import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

const accountSelect = {
    id: true,
    code: true,
    reduced_code: true,
    name: true,
    level: true,
    type: true,
    alias: true,
    report_type: true,
    report_category: true,
    parent_id: true,
    is_analytic: true,
    created_at: true,
} as const;

const verifyClientOwnership = async (clientId: string, accountingId: string) => {
    const client = await prisma.client.findFirst({
        where: { id: clientId, accounting_id: accountingId },
        select: { id: true },
    });
    return client !== null;
};

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

export const create = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const { code, reduced_code, name, level, type, alias, report_type, report_category, parent_id } = req.body;
        if (!code || !name) {
            return res.status(400).json({ message: 'Código e nome são obrigatórios' });
        }

        const account = await prisma.chartOfAccounts.create({
            data: {
                accounting_id: req.accountingId,
                client_id: clientId,
                code: String(code).trim(),
                reduced_code: reduced_code ? String(reduced_code).trim() : null,
                name: String(name).trim(),
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
            return res.status(400).json({ message: 'Código ou código reduzido já existe para este cliente' });
        }
        console.error('Erro ao criar conta:', error);
        res.status(500).json({ message: 'Erro ao criar conta' });
    }
};

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

        for (const acc of accounts) {
            if (!acc.code || !acc.name) {
                return res.status(400).json({
                    message: `Conta inválida: código e nome obrigatórios (código: ${acc.code || 'vazio'})`,
                });
            }
        }

        const normalizedAccounts = accounts.map((acc: any) => ({
            code: String(acc.code).trim(),
            reduced_code: acc.reduced_code ? String(acc.reduced_code).trim() : null,
            name: String(acc.name).trim(),
            level: parseInt(acc.level) || 1,
            type: String(acc.type || 'A').trim(),
            alias: acc.alias ? String(acc.alias).trim() : null,
            report_type: acc.report_type ? String(acc.report_type).trim() : null,
            report_category: acc.report_category ? String(acc.report_category).trim() : null,
            parent_id: null,
            is_analytic: String(acc.type || 'A').trim() !== 'T',
        }));

        const incomingCodes = normalizedAccounts.map((acc) => acc.code);
        const batchSize = 25;
        let totalUpserted = 0;

        for (let i = 0; i < normalizedAccounts.length; i += batchSize) {
            const batch = normalizedAccounts.slice(i, i + batchSize);
            await Promise.all(
                batch.map((acc) =>
                    prisma.chartOfAccounts.upsert({
                        where: {
                            client_id_code: {
                                client_id: clientId,
                                code: acc.code,
                            },
                        },
                        update: {
                            reduced_code: acc.reduced_code,
                            name: acc.name,
                            level: acc.level,
                            type: acc.type,
                            alias: acc.alias,
                            report_type: acc.report_type,
                            report_category: acc.report_category,
                            parent_id: acc.parent_id,
                            is_analytic: acc.is_analytic,
                        },
                        create: {
                            accounting_id: req.accountingId!,
                            client_id: clientId,
                            code: acc.code,
                            reduced_code: acc.reduced_code,
                            name: acc.name,
                            level: acc.level,
                            type: acc.type,
                            alias: acc.alias,
                            report_type: acc.report_type,
                            report_category: acc.report_category,
                            parent_id: acc.parent_id,
                            is_analytic: acc.is_analytic,
                        },
                    })
                )
            );
            totalUpserted += batch.length;
        }

        await prisma.chartOfAccounts.deleteMany({
            where: {
                client_id: clientId,
                code: { notIn: incomingCodes },
            },
        });

        res.json({
            message: 'Plano de contas importado com sucesso',
            count: totalUpserted,
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(400).json({ message: 'Código ou código reduzido duplicado no plano de contas' });
        }
        console.error('Erro ao importar plano de contas:', error);
        res.status(500).json({
            message: 'Erro ao importar plano de contas',
            detail: error?.message || String(error),
            code: error?.code,
            meta: error?.meta,
        });
    }
};

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

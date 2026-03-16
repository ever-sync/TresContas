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

type ImportAccountPayload = {
    code: unknown;
    reduced_code?: unknown;
    name: unknown;
    level?: unknown;
    type?: unknown;
    alias?: unknown;
    report_type?: unknown;
    report_category?: unknown;
};

const verifyClientOwnership = async (clientId: string, accountingId: string) => {
    const client = await prisma.client.findFirst({
        where: { id: clientId, accounting_id: accountingId },
        select: { id: true },
    });
    return client !== null;
};

const ensureSharedChartAccess = async (req: AuthRequest, res: Response) => {
    if (!req.accountingId) {
        res.status(401).json({ message: 'Nao autorizado' });
        return false;
    }

    const clientId = req.params.clientId ? String(req.params.clientId) : null;
    if (clientId && !await verifyClientOwnership(clientId, req.accountingId)) {
        res.status(404).json({ message: 'Cliente nao encontrado' });
        return false;
    }

    return true;
};

const normalizeAccountType = (type: unknown) =>
    String(type || 'A')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

const isTitleType = (type: unknown) => {
    const normalized = normalizeAccountType(type);
    return (
        normalized === 'T' ||
        normalized === 'S' ||
        normalized === 'TOTAL' ||
        normalized.includes('SINT') ||
        normalized.includes('TIT')
    );
};

const normalizeAccountInput = (account: ImportAccountPayload) => {
    const titleType = isTitleType(account.type);
    return {
        code: String(account.code || '').trim(),
        reduced_code: account.reduced_code ? String(account.reduced_code).trim() : null,
        name: String(account.name || '').trim(),
        level: parseInt(String(account.level || '1'), 10) || 1,
        type: titleType ? 'T' : 'A',
        alias: account.alias ? String(account.alias).trim() : null,
        report_type: account.report_type ? String(account.report_type).trim() : null,
        report_category: account.report_category ? String(account.report_category).trim() : null,
        parent_id: null,
        is_analytic: !titleType,
    };
};

export const getAll = async (req: AuthRequest, res: Response) => {
    try {
        if (!await ensureSharedChartAccess(req, res)) {
            return;
        }

        const accounts = await prisma.chartOfAccounts.findMany({
            where: { accounting_id: req.accountingId },
            orderBy: { code: 'asc' },
            select: accountSelect,
        });

        res.json(accounts);
    } catch (error: any) {
        console.error('Erro ao buscar plano de contas compartilhado:', error);
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
        if (!await ensureSharedChartAccess(req, res)) {
            return;
        }

        const normalized = normalizeAccountInput(req.body as ImportAccountPayload);
        if (!normalized.code || !normalized.name) {
            return res.status(400).json({ message: 'Codigo e nome sao obrigatorios' });
        }

        const account = await prisma.chartOfAccounts.create({
            data: {
                accounting_id: req.accountingId!,
                client_id: null,
                ...normalized,
            },
            select: accountSelect,
        });

        res.status(201).json(account);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(400).json({ message: 'Codigo ou codigo reduzido ja existe no plano compartilhado' });
        }
        console.error('Erro ao criar conta no plano compartilhado:', error);
        res.status(500).json({ message: 'Erro ao criar conta' });
    }
};

export const bulkImport = async (req: AuthRequest, res: Response) => {
    try {
        if (!await ensureSharedChartAccess(req, res)) {
            return;
        }

        const payloadAccounts = Array.isArray(req.body?.accounts) ? req.body.accounts as ImportAccountPayload[] : [];
        if (payloadAccounts.length === 0) {
            return res.status(400).json({ message: 'Lista de contas e obrigatoria' });
        }

        const normalizedAccounts = payloadAccounts.map(normalizeAccountInput);
        for (const account of normalizedAccounts) {
            if (!account.code || !account.name) {
                return res.status(400).json({
                    message: `Conta invalida: codigo e nome obrigatorios (codigo: ${account.code || 'vazio'})`,
                });
            }
        }

        const incomingCodes = normalizedAccounts.map((account) => account.code);
        const batchSize = 25;
        let totalUpserted = 0;

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < normalizedAccounts.length; i += batchSize) {
                const batch = normalizedAccounts.slice(i, i + batchSize);
                await Promise.all(
                    batch.map((account) =>
                        tx.chartOfAccounts.upsert({
                            where: {
                                accounting_id_code: {
                                    accounting_id: req.accountingId!,
                                    code: account.code,
                                },
                            },
                            update: {
                                reduced_code: account.reduced_code,
                                name: account.name,
                                level: account.level,
                                type: account.type,
                                alias: account.alias,
                                report_type: account.report_type,
                                report_category: account.report_category,
                                parent_id: account.parent_id,
                                is_analytic: account.is_analytic,
                                client_id: null,
                            },
                            create: {
                                accounting_id: req.accountingId!,
                                client_id: null,
                                ...account,
                            },
                        })
                    )
                );
                totalUpserted += batch.length;
            }

            await tx.chartOfAccounts.deleteMany({
                where: {
                    accounting_id: req.accountingId!,
                    code: { notIn: incomingCodes },
                },
            });
        });

        res.json({
            message: 'Plano de contas compartilhado importado com sucesso',
            count: totalUpserted,
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(400).json({ message: 'Codigo ou codigo reduzido duplicado no plano compartilhado' });
        }
        console.error('Erro ao importar plano de contas compartilhado:', error);
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
        if (!await ensureSharedChartAccess(req, res)) {
            return;
        }

        const id = String(req.params.id);
        const deleted = await prisma.chartOfAccounts.deleteMany({
            where: { id, accounting_id: req.accountingId },
        });

        if (deleted.count === 0) {
            return res.status(404).json({ message: 'Conta nao encontrada' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Erro ao excluir conta do plano compartilhado:', error);
        res.status(500).json({ message: 'Erro ao excluir conta' });
    }
};

export const removeAll = async (req: AuthRequest, res: Response) => {
    try {
        if (!await ensureSharedChartAccess(req, res)) {
            return;
        }

        const deleted = await prisma.chartOfAccounts.deleteMany({
            where: { accounting_id: req.accountingId },
        });

        res.json({ message: 'Plano de contas compartilhado removido', count: deleted.count });
    } catch (error) {
        console.error('Erro ao limpar plano de contas compartilhado:', error);
        res.status(500).json({ message: 'Erro ao limpar plano de contas' });
    }
};

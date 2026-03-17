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

        // Deduplicar por code (manter o último se houver repetidos)
        const deduped = new Map<string, typeof normalizedAccounts[number]>();
        for (const account of normalizedAccounts) {
            deduped.set(account.code, account);
        }
        const uniqueAccounts = Array.from(deduped.values());

        // Deduplicar reduced_code (null é ok, mas dois iguais não)
        const seenReducedCodes = new Set<string>();
        for (const account of uniqueAccounts) {
            if (account.reduced_code) {
                if (seenReducedCodes.has(account.reduced_code)) {
                    account.reduced_code = null; // limpar duplicado
                } else {
                    seenReducedCodes.add(account.reduced_code);
                }
            }
        }

        // Estratégia: delete all + createMany (muito mais rápido que N upserts)
        const batchSize = 500;
        let totalCreated = 0;

        // Primeiro, remover referências de DFCLineMapping que apontam para contas que serão deletadas
        await prisma.dFCLineMapping.deleteMany({
            where: {
                chart_account: { accounting_id: req.accountingId! },
            },
        });

        await prisma.chartOfAccounts.deleteMany({
            where: { accounting_id: req.accountingId! },
        });

        for (let i = 0; i < uniqueAccounts.length; i += batchSize) {
            const batch = uniqueAccounts.slice(i, i + batchSize);
            const result = await prisma.chartOfAccounts.createMany({
                data: batch.map((account) => ({
                    accounting_id: req.accountingId!,
                    client_id: null,
                    ...account,
                })),
                skipDuplicates: true,
            });
            totalCreated += result.count;
        }

        res.json({
            message: 'Plano de contas compartilhado importado com sucesso',
            count: totalCreated,
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

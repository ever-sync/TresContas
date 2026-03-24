import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError, sendErrorResponse } from '../lib/http';
import { toTrimmedString } from '../lib/validation';

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

const ensureSharedChartAccess = async (req: AuthRequest) => {
    if (!req.accountingId) {
        throw new AppError(401, 'Não autorizado');
    }

    const clientId = req.params.clientId ? String(req.params.clientId) : null;
    if (clientId && !await verifyClientOwnership(clientId, req.accountingId)) {
        throw new AppError(404, 'Cliente não encontrado');
    }
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
        code: toTrimmedString(account.code),
        reduced_code: account.reduced_code ? toTrimmedString(account.reduced_code) : null,
        name: toTrimmedString(account.name),
        level: Number.parseInt(String(account.level || '1'), 10) || 1,
        type: titleType ? 'T' : 'A',
        alias: account.alias ? toTrimmedString(account.alias) : null,
        report_type: account.report_type ? toTrimmedString(account.report_type) : null,
        report_category: account.report_category ? toTrimmedString(account.report_category) : null,
        parent_id: null,
        is_analytic: !titleType,
    };
};

export const getAll = async (req: AuthRequest, res: Response) => {
    try {
        await ensureSharedChartAccess(req);

        const accounts = await prisma.chartOfAccounts.findMany({
            where: { accounting_id: req.accountingId },
            orderBy: { code: 'asc' },
            select: accountSelect,
        });

        res.json(accounts);
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao buscar plano de contas');
    }
};

export const create = async (req: AuthRequest, res: Response) => {
    try {
        await ensureSharedChartAccess(req);

        const normalized = normalizeAccountInput(req.body as ImportAccountPayload);
        if (!normalized.code || !normalized.name) {
            throw new AppError(400, 'Código e nome são obrigatórios');
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
    } catch (error: unknown) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
            return res.status(400).json({ message: 'Código ou código reduzido já existe no plano compartilhado' });
        }

        return sendErrorResponse(res, error, 'Erro ao criar conta');
    }
};

export const bulkImport = async (req: AuthRequest, res: Response) => {
    try {
        await ensureSharedChartAccess(req);

        const payloadAccounts = Array.isArray(req.body?.accounts)
            ? req.body.accounts as ImportAccountPayload[]
            : [];

        if (payloadAccounts.length === 0) {
            throw new AppError(400, 'Lista de contas é obrigatória');
        }

        const normalizedAccounts = payloadAccounts.map(normalizeAccountInput);

        for (const account of normalizedAccounts) {
            if (!account.code || !account.name) {
                throw new AppError(
                    400,
                    `Conta inválida: código e nome obrigatórios (código: ${account.code || 'vazio'})`
                );
            }
        }

        const deduped = new Map<string, typeof normalizedAccounts[number]>();
        for (const account of normalizedAccounts) {
            deduped.set(account.code, account);
        }
        const uniqueAccounts = Array.from(deduped.values());

        const seenReducedCodes = new Set<string>();
        for (const account of uniqueAccounts) {
            if (!account.reduced_code) {
                continue;
            }

            if (seenReducedCodes.has(account.reduced_code)) {
                account.reduced_code = null;
                continue;
            }

            seenReducedCodes.add(account.reduced_code);
        }

        const batchSize = 500;
        let totalCreated = 0;

        await prisma.$transaction(async (tx) => {
            const existingAccountIds = (await tx.chartOfAccounts.findMany({
                where: { accounting_id: req.accountingId! },
                select: { id: true },
            })).map((account) => account.id);

            if (existingAccountIds.length > 0) {
                await tx.accountingEntryItem.deleteMany({
                    where: { account_id: { in: existingAccountIds } },
                });

                await tx.dFCLineMapping.deleteMany({
                    where: { accounting_id: req.accountingId! },
                });

                await tx.dREMapping.deleteMany({
                    where: {
                        accounting_id: req.accountingId!,
                        client_id: { not: null } as any,
                    },
                });

                await tx.chartOfAccounts.deleteMany({
                    where: { accounting_id: req.accountingId! },
                });
            }

            for (let index = 0; index < uniqueAccounts.length; index += batchSize) {
                const batch = uniqueAccounts.slice(index, index + batchSize);
                const result = await tx.chartOfAccounts.createMany({
                    data: batch.map((account) => ({
                        accounting_id: req.accountingId!,
                        client_id: null,
                        ...account,
                    })),
                    skipDuplicates: true,
                });
                totalCreated += result.count;
            }
        });

        res.json({
            message: 'Plano de contas compartilhado importado com sucesso',
            count: totalCreated,
        });
    } catch (error: unknown) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
            return res.status(400).json({ message: 'Código ou código reduzido duplicado no plano compartilhado' });
        }

        return sendErrorResponse(res, error, 'Erro ao importar plano de contas');
    }
};

export const remove = async (req: AuthRequest, res: Response) => {
    try {
        await ensureSharedChartAccess(req);

        const deleted = await prisma.chartOfAccounts.deleteMany({
            where: { id: String(req.params.id), accounting_id: req.accountingId },
        });

        if (deleted.count === 0) {
            throw new AppError(404, 'Conta não encontrada');
        }

        res.status(204).send();
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao excluir conta');
    }
};

export const removeAll = async (req: AuthRequest, res: Response) => {
    try {
        await ensureSharedChartAccess(req);

        const deleted = await prisma.chartOfAccounts.deleteMany({
            where: { accounting_id: req.accountingId },
        });

        res.json({ message: 'Plano de contas compartilhado removido', count: deleted.count });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao limpar plano de contas');
    }
};

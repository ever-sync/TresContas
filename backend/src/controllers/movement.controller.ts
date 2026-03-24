import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError, sendErrorResponse } from '../lib/http';
import { parseRequiredYear, toTrimmedString } from '../lib/validation';

const verifyClientOwnership = async (clientId: string, accountingId: string) => {
    const client = await prisma.client.findFirst({
        where: { id: clientId, accounting_id: accountingId },
        select: { id: true },
    });

    return client !== null;
};

const removeDiacritics = (text: string): string => {
    if (!text) return '';

    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

type ImportMovementPayload = {
    code: unknown;
    reduced_code?: unknown;
    name: unknown;
    level?: unknown;
    category?: unknown;
    values: unknown[];
};

const toMonthlyDeltaValues = (values: number[]) =>
    values.map((value, index) => {
        if (index === 0) return value;
        return value - values[index - 1];
    });

const parseYearFromQuery = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
        return new Date().getFullYear();
    }

    return parseRequiredYear(value);
};

export const getMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const clientId = String(req.params.clientId);

        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            throw new AppError(404, 'Cliente não encontrado');
        }

        const year = parseYearFromQuery(req.query.year);
        const type = req.query.type as string | undefined;

        const whereClause: Record<string, unknown> = { client_id: clientId, year };
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
        return sendErrorResponse(res, error, 'Erro ao buscar movimentações');
    }
};

export const importMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const clientId = String(req.params.clientId);

        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            throw new AppError(404, 'Cliente não encontrado');
        }

        const movementType = req.body?.type === 'patrimonial' ? 'patrimonial' : 'dre';
        const valueMode = req.body?.valueMode;
        const parsedYear = parseRequiredYear(req.body?.year);
        const incomingMovements = Array.isArray(req.body?.movements)
            ? req.body.movements as ImportMovementPayload[]
            : [];

        if (incomingMovements.length === 0) {
            throw new AppError(400, 'Ano e lista de movimentações são obrigatórios');
        }

        const shouldConvertAccumulatedToMonthly =
            movementType === 'dre' && valueMode === 'cumulative';

        for (const movement of incomingMovements) {
            const code = toTrimmedString(movement.code);
            const name = toTrimmedString(movement.name);

            if (!code || !name) {
                throw new AppError(
                    400,
                    `Movimentação inválida: código e nome obrigatórios (código: ${code || 'vazio'})`
                );
            }

            if (!Array.isArray(movement.values) || movement.values.length !== 12) {
                throw new AppError(
                    400,
                    `Movimentação ${code}: values deve ter exatamente 12 elementos (Jan-Dez)`
                );
            }
        }

        const chartAccounts = await prisma.chartOfAccounts.findMany({
            where: { accounting_id: req.accountingId },
            select: {
                client_id: true,
                code: true,
                reduced_code: true,
                report_category: true,
            },
        });

        const chartAccountByCode = new Map<string, {
            client_id: string | null;
            reduced_code: string | null;
            report_category: string | null;
        }>();

        for (const account of chartAccounts) {
            const normalizedCode = account.code.trim();
            const existing = chartAccountByCode.get(normalizedCode);

            if (!existing || (account.client_id === clientId && existing.client_id !== clientId)) {
                chartAccountByCode.set(normalizedCode, {
                    client_id: account.client_id,
                    reduced_code: account.reduced_code,
                    report_category: account.report_category,
                });
            }
        }

        const dreMappings = await prisma.dREMapping.findMany({
            where: { client_id: clientId },
            select: { account_code: true, category: true },
        });

        const dreMappingByCode = new Map(
            dreMappings.map((mapping) => [mapping.account_code.trim(), mapping.category])
        );

        const inferDreCategoryFromCode = (code: string): string | null => {
            if (code.startsWith('03.1.01')) return 'receita bruta';
            if (code.startsWith('03.1.02')) return 'deducoes de vendas';
            if (code.startsWith('03.1.03')) return 'receitas financeiras';
            if (code.startsWith('03.1.05')) return 'outras receitas';
            if (code.startsWith('03.2')) return 'outras receitas';
            if (code.startsWith('04.1')) return 'custos das vendas';
            if (code.startsWith('04.2.01')) return 'despesas comerciais';
            if (code.startsWith('04.2.02')) return 'despesas administrativas';
            if (code.startsWith('04.2.03')) return 'despesas financeiras';
            if (code.startsWith('04.2.05')) return 'despesas tributarias';
            if (code.startsWith('04.2')) return 'outras despesas';
            if (code.startsWith('04.3')) return 'irpj e csll';
            return null;
        };

        const normalizedMovements = incomingMovements.map((movement) => {
            let normalizedCategory = null;

            if (movement.category && movement.category !== '#REF!' && movement.category !== '#REF') {
                const category = String(movement.category).trim();
                normalizedCategory = removeDiacritics(category) || category;
            }

            const code = toTrimmedString(movement.code);
            const payloadReducedCode = movement.reduced_code
                ? toTrimmedString(movement.reduced_code)
                : null;
            const sharedAccount = chartAccountByCode.get(code);
            const reducedCode = sharedAccount?.reduced_code || payloadReducedCode || null;
            const configuredCategory = dreMappingByCode.get(code) || null;
            const sharedCategory =
                sharedAccount?.client_id === clientId && sharedAccount.report_category
                    ? removeDiacritics(sharedAccount.report_category)
                    : null;
            const inferredCategory = movementType === 'dre'
                ? inferDreCategoryFromCode(code)
                : null;
            const resolvedCategory =
                configuredCategory || normalizedCategory || sharedCategory || inferredCategory;
            const parsedValues = movement.values.map((value) => Number.parseFloat(String(value)) || 0);
            const values = shouldConvertAccumulatedToMonthly
                ? toMonthlyDeltaValues(parsedValues)
                : parsedValues;

            return {
                accounting_id: req.accountingId!,
                client_id: clientId,
                year: parsedYear,
                code,
                reduced_code: reducedCode,
                name: toTrimmedString(movement.name),
                level: Number.parseInt(String(movement.level || '1'), 10) || 1,
                type: movementType,
                category: resolvedCategory,
                values,
                is_mapped: !!(resolvedCategory && resolvedCategory !== '#ref' && resolvedCategory !== ''),
            };
        });

        const batchSize = 100;
        let totalCreated = 0;

        await prisma.$transaction(async (tx) => {
            await tx.monthlyMovement.deleteMany({
                where: { client_id: clientId, year: parsedYear, type: movementType },
            });

            for (let index = 0; index < normalizedMovements.length; index += batchSize) {
                const batch = normalizedMovements.slice(index, index + batchSize);
                const created = await tx.monthlyMovement.createMany({
                    data: batch,
                    skipDuplicates: true,
                });
                totalCreated += created.count;
            }
        });

        res.json({
            message: 'Movimentações importadas com sucesso',
            count: totalCreated,
            year: parsedYear,
            type: movementType,
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao importar movimentações');
    }
};

export const removeMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const clientId = String(req.params.clientId);

        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            throw new AppError(404, 'Cliente não encontrado');
        }

        const year = parseYearFromQuery(req.query.year);
        const type = req.query.type as string | undefined;
        const whereClause: Record<string, unknown> = { client_id: clientId, year };

        if (type && ['dre', 'patrimonial'].includes(type)) {
            whereClause.type = type;
        }

        const deleted = await prisma.monthlyMovement.deleteMany({
            where: whereClause,
        });

        res.json({ message: 'Movimentações removidas', count: deleted.count, year });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao remover movimentações');
    }
};

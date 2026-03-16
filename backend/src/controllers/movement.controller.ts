import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

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

export const getMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const year = parseInt(String(req.query.year || ''), 10) || new Date().getFullYear();
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
    } catch (error: any) {
        console.error('Erro ao buscar movimentacoes:', error);
        res.status(500).json({
            message: 'Erro ao buscar movimentacoes',
            detail: error?.message || String(error),
        });
    }
};

export const importMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const { year, movements, type } = req.body;
        if (!year || !Array.isArray(movements) || movements.length === 0) {
            return res.status(400).json({ message: 'Ano e lista de movimentacoes sao obrigatorios' });
        }

        const parsedYear = parseInt(String(year), 10);
        if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
            return res.status(400).json({ message: 'Ano invalido' });
        }

        const movementType = type === 'patrimonial' ? 'patrimonial' : 'dre';
        const incomingMovements = movements as ImportMovementPayload[];

        for (const movement of incomingMovements) {
            if (!movement.code || !movement.name) {
                return res.status(400).json({
                    message: `Movimentacao invalida: codigo e nome obrigatorios (codigo: ${movement.code || 'vazio'})`,
                });
            }
            if (!Array.isArray(movement.values) || movement.values.length !== 12) {
                return res.status(400).json({
                    message: `Movimentacao ${movement.code}: values deve ter exatamente 12 elementos (Jan-Dez)`,
                });
            }
        }

        const chartAccounts = await prisma.chartOfAccounts.findMany({
            where: { accounting_id: req.accountingId },
            select: {
                code: true,
                reduced_code: true,
                report_category: true,
            },
        });
        const chartAccountByCode = new Map(
            chartAccounts.map((account) => [
                account.code.trim(),
                {
                    reduced_code: account.reduced_code,
                    report_category: account.report_category,
                },
            ])
        );

        // Inferência automática de categoria DRE pelo prefixo do código contábil
        // Usado como último fallback quando não há DE-PARA no CSV nem report_category no plano de contas
        const inferDreCategoryFromCode = (code: string): string | null => {
            if (code.startsWith('03.1.01')) return 'receita bruta';
            if (code.startsWith('03.1.02')) return 'deducoes de vendas';
            if (code.startsWith('03.1.03')) return 'receitas financeiras';
            if (code.startsWith('03.1.05')) return 'outras receitas';
            if (code.startsWith('03.2'))    return 'outras receitas';
            if (code.startsWith('04.1.01')) return 'custos das vendas';
            if (code.startsWith('04.1.07')) return 'outras despesas';
            if (code.startsWith('04.2.01')) return 'despesas comerciais';
            if (code.startsWith('04.2.02')) return 'despesas administrativas';
            if (code.startsWith('04.2.03')) return 'despesas financeiras';
            if (code.startsWith('04.2.05')) return 'despesas tributarias';
            if (code.startsWith('04.3'))    return 'irpj e csll';
            return null;
        };

        const normalizedMovements = incomingMovements.map((movement) => {
            let normalizedCategory = null;
            if (movement.category && movement.category !== '#REF!' && movement.category !== '#REF') {
                const categoryStr = String(movement.category).trim();
                normalizedCategory = removeDiacritics(categoryStr) || categoryStr;
            }

            const code = String(movement.code).trim();
            const payloadReducedCode = movement.reduced_code ? String(movement.reduced_code).trim() : null;
            const sharedAccount = chartAccountByCode.get(code);
            const reducedCode = sharedAccount?.reduced_code || payloadReducedCode || null;
            const sharedCategory = sharedAccount?.report_category ? removeDiacritics(sharedAccount.report_category) : null;
            const inferredCategory = movementType === 'dre' ? inferDreCategoryFromCode(code) : null;
            const resolvedCategory = movementType === 'dre'
                ? normalizedCategory || sharedCategory || inferredCategory
                : normalizedCategory;

            return {
                accounting_id: req.accountingId!,
                client_id: clientId,
                year: parsedYear,
                code,
                reduced_code: reducedCode,
                name: String(movement.name).trim(),
                level: parseInt(String(movement.level || '1'), 10) || 1,
                type: movementType,
                category: resolvedCategory,
                values: movement.values.map((value) => parseFloat(String(value)) || 0),
                is_mapped: !!(resolvedCategory && resolvedCategory !== '#ref' && resolvedCategory !== ''),
            };
        });

        const batchSize = 100;
        let totalCreated = 0;

        await prisma.$transaction(async (tx) => {
            await tx.monthlyMovement.deleteMany({
                where: { client_id: clientId, year: parsedYear, type: movementType },
            });

            for (let i = 0; i < normalizedMovements.length; i += batchSize) {
                const batch = normalizedMovements.slice(i, i + batchSize);
                const created = await tx.monthlyMovement.createMany({
                    data: batch,
                    skipDuplicates: true,
                });
                totalCreated += created.count;
            }
        });

        res.json({
            message: 'Movimentacoes importadas com sucesso',
            count: totalCreated,
            year: parsedYear,
            type: movementType,
        });
    } catch (error: any) {
        console.error('Erro ao importar movimentacoes:', error);
        res.status(500).json({
            message: 'Erro ao importar movimentacoes',
            detail: error?.message || String(error),
        });
    }
};

export const removeMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const year = parseInt(String(req.query.year || ''), 10) || new Date().getFullYear();
        const type = req.query.type as string | undefined;

        const whereClause: Record<string, unknown> = { client_id: clientId, year };
        if (type && ['dre', 'patrimonial'].includes(type)) {
            whereClause.type = type;
        }

        const deleted = await prisma.monthlyMovement.deleteMany({
            where: whereClause,
        });

        res.json({ message: 'Movimentacoes removidas', count: deleted.count, year });
    } catch (error: any) {
        console.error('Erro ao remover movimentacoes:', error);
        res.status(500).json({
            message: 'Erro ao remover movimentacoes',
            detail: error?.message || String(error),
        });
    }
};

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

/**
 * GET /api/clients/:clientId/movements?year=2025&type=dre
 */
export const getMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const type = req.query.type as string | undefined;

        const whereClause: any = { client_id: clientId, year };
        if (type && ['dre', 'patrimonial'].includes(type)) {
            whereClause.type = type;
        }

        const movements = await prisma.monthlyMovement.findMany({
            where: whereClause,
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true, level: true, type: true, category: true, values: true },
        });

        res.json(movements);
    } catch (error: any) {
        console.error('Erro ao buscar movimentações:', error);
        res.status(500).json({
            message: 'Erro ao buscar movimentações',
            detail: error?.message || String(error),
        });
    }
};

/**
 * POST /api/clients/:clientId/movements/import
 * Body: { year: number, type: 'dre' | 'patrimonial', movements: [{ code, name, level, values: number[12] }] }
 */
export const importMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const { year, movements, type } = req.body;

        if (!year || !Array.isArray(movements) || movements.length === 0) {
            return res.status(400).json({ message: 'Ano e lista de movimentações são obrigatórios' });
        }

        const movementType = (type === 'patrimonial') ? 'patrimonial' : 'dre';

        // Validação básica
        for (const m of movements) {
            if (!m.code || !m.name) {
                return res.status(400).json({ message: `Movimentação inválida: código e nome obrigatórios (código: ${m.code || 'vazio'})` });
            }
            if (!Array.isArray(m.values) || m.values.length !== 12) {
                return res.status(400).json({ message: `Movimentação ${m.code}: values deve ter exatamente 12 elementos (Jan-Dez)` });
            }
        }

        // Sem transação para compatibilidade com pgBouncer
        // Passo 1: deletar movimentações existentes do ano E tipo
        await prisma.monthlyMovement.deleteMany({
            where: { client_id: clientId, year: Number(year), type: movementType },
        });

        // Passo 2: inserir em lotes de 100
        const batchSize = 100;
        let totalCreated = 0;

        for (let i = 0; i < movements.length; i += batchSize) {
            const batch = movements.slice(i, i + batchSize);
            const created = await prisma.monthlyMovement.createMany({
                data: batch.map((m: any) => {
                    const isMapped = m.category && m.category !== '#REF!' && m.category !== '#REF';
                    return {
                        accounting_id: req.accountingId!,
                        client_id: clientId,
                        year: Number(year),
                        code: String(m.code).trim(),
                        name: String(m.name).trim(),
                        level: parseInt(m.level) || 1,
                        type: movementType,
                        category: m.category ? String(m.category).trim() : null,
                        values: m.values.map((v: any) => parseFloat(v) || 0),
                        is_mapped: isMapped,
                    };
                }),
                skipDuplicates: true,
            });
            totalCreated += created.count;
        }

        res.json({ message: 'Movimentações importadas com sucesso', count: totalCreated, year, type: movementType });
    } catch (error: any) {
        console.error('Erro ao importar movimentações:', error);
        res.status(500).json({
            message: 'Erro ao importar movimentações',
            detail: error?.message || String(error),
        });
    }
};

/**
 * DELETE /api/clients/:clientId/movements?year=2025&type=dre
 */
export const removeMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const type = req.query.type as string | undefined;

        const whereClause: any = { client_id: clientId, year };
        if (type && ['dre', 'patrimonial'].includes(type)) {
            whereClause.type = type;
        }

        const deleted = await prisma.monthlyMovement.deleteMany({
            where: whereClause,
        });

        res.json({ message: 'Movimentações removidas', count: deleted.count, year });
    } catch (error: any) {
        console.error('Erro ao remover movimentações:', error);
        res.status(500).json({
            message: 'Erro ao remover movimentações',
            detail: error?.message || String(error),
        });
    }
};

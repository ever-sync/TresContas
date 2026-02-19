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
 * GET /api/clients/:clientId/dre-mappings
 * Retorna todos os mapeamentos DE-PARA para um cliente
 */
export const getDREMappings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const mappings = await prisma.dREMapping.findMany({
            where: { client_id: clientId },
            orderBy: { account_code: 'asc' },
        });

        res.json(mappings);
    } catch (error: any) {
        console.error('Erro ao buscar mapeamentos DRE:', error);
        res.status(500).json({
            message: 'Erro ao buscar mapeamentos DRE',
            detail: error?.message || String(error),
        });
    }
};

/**
 * POST /api/clients/:clientId/dre-mappings
 * Cria ou atualiza um mapeamento DE-PARA
 * Body: { account_code: string, account_name: string, category: string }
 */
export const createOrUpdateDREMapping = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const { account_code, account_name, category } = req.body;

        if (!account_code || !account_name || !category) {
            return res.status(400).json({ message: 'account_code, account_name e category são obrigatórios' });
        }

        // Validar se a categoria é uma das 30 categorias conhecidas
        const validCategories = [
            'Adiantamentos', 'Clientes', 'Contas A Pagar Cp', 'Custos Das Vendas', 'Deduções',
            'Despesas Administrativas', 'Despesas Antecipadas', 'Despesas Comerciais', 'Despesas Financeiras',
            'Despesas Tributarias', 'Disponivel', 'Emprestimos E Financiamentos Cp', 'Estoques', 'Fornecedores',
            'Imobilizado', 'Intangivel', 'Irpj E Csll', 'Obrigacoes Trabalhistas', 'Obrigacoes Tributarias',
            'Outras Contas A Pagar Lp', 'Outras Contas A Receber Lp', 'Outras Receitas', 'Parcelamentos Cp',
            'Parcelamentos Lp', 'Processos Judiciais', 'Receita Bruta', 'Receitas Financeiras',
            'Reserva De Lucros', 'Resultado Do Exercicio', 'Tributos A CompensarCP'
        ];

        const normalizedCategory = category.trim();
        if (!validCategories.includes(normalizedCategory)) {
            return res.status(400).json({
                message: `Categoria inválida: ${normalizedCategory}. Categorias válidas: ${validCategories.join(', ')}`,
            });
        }

        // Usar upsert para criar ou atualizar
        const mapping = await prisma.dREMapping.upsert({
            where: {
                client_id_account_code: {
                    client_id: clientId,
                    account_code: String(account_code).trim(),
                },
            },
            update: {
                account_name: String(account_name).trim(),
                category: normalizedCategory,
                updated_at: new Date(),
            },
            create: {
                accounting_id: req.accountingId,
                client_id: clientId,
                account_code: String(account_code).trim(),
                account_name: String(account_name).trim(),
                category: normalizedCategory,
            },
        });

        // Atualizar também o ChartOfAccounts se existir
        await prisma.chartOfAccounts.updateMany({
            where: {
                client_id: clientId,
                code: String(account_code).trim(),
            },
            data: {
                report_category: normalizedCategory,
                is_mapped: true,
            },
        });

        res.json({ message: 'Mapeamento DRE salvo com sucesso', mapping });
    } catch (error: any) {
        console.error('Erro ao salvar mapeamento DRE:', error);
        res.status(500).json({
            message: 'Erro ao salvar mapeamento DRE',
            detail: error?.message || String(error),
        });
    }
};

/**
 * DELETE /api/clients/:clientId/dre-mappings/:account_code
 * Remove um mapeamento DE-PARA
 */
export const deleteDREMapping = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        const accountCode = String(req.params.account_code);

        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        await prisma.dREMapping.delete({
            where: {
                client_id_account_code: {
                    client_id: clientId,
                    account_code: accountCode,
                },
            },
        });

        // Remover mapeamento também do ChartOfAccounts
        await prisma.chartOfAccounts.updateMany({
            where: {
                client_id: clientId,
                code: accountCode,
            },
            data: {
                report_category: null,
                is_mapped: false,
            },
        });

        res.json({ message: 'Mapeamento DRE removido com sucesso' });
    } catch (error: any) {
        console.error('Erro ao remover mapeamento DRE:', error);
        res.status(500).json({
            message: 'Erro ao remover mapeamento DRE',
            detail: error?.message || String(error),
        });
    }
};

/**
 * GET /api/clients/:clientId/unmapped-movements?year=2025&type=dre
 * Retorna movimentações que não estão mapeadas no Plano de Contas
 */
export const getUnmappedMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const type = (req.query.type as string) || 'dre';

        // Buscar movimentações que não têm mapeamento
        const unmappedMovements = await prisma.monthlyMovement.findMany({
            where: {
                client_id: clientId,
                year,
                type,
                is_mapped: false,
                level: 15, // Apenas contas analíticas
            },
            select: {
                id: true,
                code: true,
                name: true,
                category: true,
                level: true,
            },
            distinct: ['code'], // Retorna apenas um registro por código
        });

        res.json(unmappedMovements);
    } catch (error: any) {
        console.error('Erro ao buscar movimentações não mapeadas:', error);
        res.status(500).json({
            message: 'Erro ao buscar movimentações não mapeadas',
            detail: error?.message || String(error),
        });
    }
};

/**
 * POST /api/clients/:clientId/bulk-dre-mappings
 * Cria múltiplos mapeamentos DE-PARA em uma única requisição
 * Body: { mappings: [{ account_code, account_name, category }, ...] }
 */
export const bulkCreateDREMappings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const { mappings } = req.body;

        if (!Array.isArray(mappings) || mappings.length === 0) {
            return res.status(400).json({ message: 'mappings deve ser um array não vazio' });
        }

        const validCategories = [
            'Adiantamentos', 'Clientes', 'Contas A Pagar Cp', 'Custos Das Vendas', 'Deduções',
            'Despesas Administrativas', 'Despesas Antecipadas', 'Despesas Comerciais', 'Despesas Financeiras',
            'Despesas Tributarias', 'Disponivel', 'Emprestimos E Financiamentos Cp', 'Estoques', 'Fornecedores',
            'Imobilizado', 'Intangivel', 'Irpj E Csll', 'Obrigacoes Trabalhistas', 'Obrigacoes Tributarias',
            'Outras Contas A Pagar Lp', 'Outras Contas A Receber Lp', 'Outras Receitas', 'Parcelamentos Cp',
            'Parcelamentos Lp', 'Processos Judiciais', 'Receita Bruta', 'Receitas Financeiras',
            'Reserva De Lucros', 'Resultado Do Exercicio', 'Tributos A CompensarCP'
        ];

        // Validar todos os mapeamentos
        for (const m of mappings) {
            if (!m.account_code || !m.account_name || !m.category) {
                return res.status(400).json({
                    message: 'Cada mapeamento deve ter account_code, account_name e category',
                });
            }
            if (!validCategories.includes(m.category.trim())) {
                return res.status(400).json({
                    message: `Categoria inválida: ${m.category}`,
                });
            }
        }

        // Inserir em lotes
        const batchSize = 100;
        let totalCreated = 0;

        for (let i = 0; i < mappings.length; i += batchSize) {
            const batch = mappings.slice(i, i + batchSize);
            const created = await prisma.dREMapping.createMany({
                data: batch.map((m: any) => ({
                    accounting_id: req.accountingId!,
                    client_id: clientId,
                    account_code: String(m.account_code).trim(),
                    account_name: String(m.account_name).trim(),
                    category: String(m.category).trim(),
                })),
                skipDuplicates: true,
            });
            totalCreated += created.count;
        }

        res.json({
            message: 'Mapeamentos DRE importados com sucesso',
            count: totalCreated,
        });
    } catch (error: any) {
        console.error('Erro ao importar mapeamentos DRE:', error);
        res.status(500).json({
            message: 'Erro ao importar mapeamentos DRE',
            detail: error?.message || String(error),
        });
    }
};

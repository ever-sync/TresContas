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

const VALID_DRE_CATEGORIES = [
    'Adiantamentos', 'Clientes', 'Contas A Pagar Cp', 'Custos Das Vendas', 'Deducoes',
    'Despesas Administrativas', 'Despesas Antecipadas', 'Despesas Comerciais', 'Despesas Financeiras',
    'Despesas Tributarias', 'Disponivel', 'Emprestimos E Financiamentos Cp', 'Estoques', 'Fornecedores',
    'Imobilizado', 'Intangivel', 'Irpj E Csll', 'Obrigacoes Trabalhistas', 'Obrigacoes Tributarias',
    'Outras Contas A Pagar Lp', 'Outras Contas A Receber Lp', 'Outras Receitas', 'Parcelamentos Cp',
    'Parcelamentos Lp', 'Processos Judiciais', 'Receita Bruta', 'Receitas Financeiras',
    'Reserva De Lucros', 'Resultado Do Exercicio', 'Tributos A CompensarCP',
];

type MappingSyncClient = Pick<typeof prisma, 'chartOfAccounts' | 'monthlyMovement' | 'dREMapping'>;

const syncMappingState = async (
    tx: MappingSyncClient,
    accountingId: string,
    accountCode: string,
    category: string | null
) => {
    await tx.chartOfAccounts.updateMany({
        where: {
            accounting_id: accountingId,
            code: accountCode,
        },
        data: {
            report_category: category,
            is_mapped: category !== null,
        },
    });

    await tx.monthlyMovement.updateMany({
        where: {
            accounting_id: accountingId,
            code: accountCode,
            type: 'dre',
        },
        data: {
            category,
            is_mapped: category !== null,
        },
    });
};

const getSharedMappings = async (accountingId: string) => {
    const mappings = await prisma.dREMapping.findMany({
        where: { accounting_id: accountingId },
        orderBy: [{ account_code: 'asc' }, { updated_at: 'desc' }],
    });

    const uniqueByCode = new Map<string, typeof mappings[number]>();
    for (const mapping of mappings) {
        if (!uniqueByCode.has(mapping.account_code)) {
            uniqueByCode.set(mapping.account_code, mapping);
        }
    }

    return Array.from(uniqueByCode.values()).sort((a, b) => a.account_code.localeCompare(b.account_code));
};

export const getDREMappings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const mappings = await getSharedMappings(req.accountingId);
        res.json(mappings);
    } catch (error: any) {
        console.error('Erro ao buscar mapeamentos DRE compartilhados:', error);
        res.status(500).json({
            message: 'Erro ao buscar mapeamentos DRE',
            detail: error?.message || String(error),
        });
    }
};

export const createOrUpdateDREMapping = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const { account_code, account_name, category } = req.body;
        if (!account_code || !account_name || !category) {
            return res.status(400).json({ message: 'account_code, account_name e category sao obrigatorios' });
        }

        const accountCode = String(account_code).trim();
        const accountName = String(account_name).trim();
        const normalizedCategory = String(category).trim();

        if (!VALID_DRE_CATEGORIES.includes(normalizedCategory)) {
            return res.status(400).json({
                message: `Categoria invalida: ${normalizedCategory}. Categorias validas: ${VALID_DRE_CATEGORIES.join(', ')}`,
            });
        }

        const mapping = await prisma.$transaction(async (tx) => {
            const upserted = await tx.dREMapping.upsert({
                where: {
                    client_id_account_code: {
                        client_id: clientId,
                        account_code: accountCode,
                    },
                },
                update: {
                    account_name: accountName,
                    category: normalizedCategory,
                    updated_at: new Date(),
                },
                create: {
                    accounting_id: req.accountingId!,
                    client_id: clientId,
                    account_code: accountCode,
                    account_name: accountName,
                    category: normalizedCategory,
                },
            });

            await syncMappingState(tx, req.accountingId!, accountCode, normalizedCategory);
            return upserted;
        });

        res.json({ message: 'Mapeamento DRE compartilhado salvo com sucesso', mapping });
    } catch (error: any) {
        console.error('Erro ao salvar mapeamento DRE:', error);
        res.status(500).json({
            message: 'Erro ao salvar mapeamento DRE',
            detail: error?.message || String(error),
        });
    }
};

export const deleteDREMapping = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        const accountCode = String(req.params.account_code);

        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.dREMapping.deleteMany({
                where: {
                    accounting_id: req.accountingId!,
                    client_id: clientId,
                    account_code: accountCode,
                },
            });

            const fallback = await tx.dREMapping.findFirst({
                where: {
                    accounting_id: req.accountingId!,
                    account_code: accountCode,
                },
                orderBy: { updated_at: 'desc' },
            });

            await syncMappingState(tx, req.accountingId!, accountCode, fallback?.category || null);
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

export const getUnmappedMovements = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const type = (req.query.type as string) || 'dre';

        const unmappedMovements = await prisma.monthlyMovement.findMany({
            where: {
                client_id: clientId,
                year,
                type,
                is_mapped: false,
                level: 15,
            },
            select: {
                id: true,
                code: true,
                name: true,
                category: true,
                level: true,
            },
            distinct: ['code'],
        });

        res.json(unmappedMovements);
    } catch (error: any) {
        console.error('Erro ao buscar movimentacoes nao mapeadas:', error);
        res.status(500).json({
            message: 'Erro ao buscar movimentacoes nao mapeadas',
            detail: error?.message || String(error),
        });
    }
};

export const bulkCreateDREMappings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const { mappings } = req.body;
        if (!Array.isArray(mappings) || mappings.length === 0) {
            return res.status(400).json({ message: 'mappings deve ser um array nao vazio' });
        }

        const normalizedMappings = mappings.map((mapping) => ({
            account_code: String(mapping.account_code || '').trim(),
            account_name: String(mapping.account_name || '').trim(),
            category: String(mapping.category || '').trim(),
        }));

        for (const mapping of normalizedMappings) {
            if (!mapping.account_code || !mapping.account_name || !mapping.category) {
                return res.status(400).json({
                    message: 'Cada mapeamento deve ter account_code, account_name e category',
                });
            }
            if (!VALID_DRE_CATEGORIES.includes(mapping.category)) {
                return res.status(400).json({
                    message: `Categoria invalida: ${mapping.category}`,
                });
            }
        }

        const batchSize = 100;
        let totalProcessed = 0;

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < normalizedMappings.length; i += batchSize) {
                const batch = normalizedMappings.slice(i, i + batchSize);

                await Promise.all(
                    batch.map(async (mapping) => {
                        await tx.dREMapping.upsert({
                            where: {
                                client_id_account_code: {
                                    client_id: clientId,
                                    account_code: mapping.account_code,
                                },
                            },
                            update: {
                                account_name: mapping.account_name,
                                category: mapping.category,
                                updated_at: new Date(),
                            },
                            create: {
                                accounting_id: req.accountingId!,
                                client_id: clientId,
                                account_code: mapping.account_code,
                                account_name: mapping.account_name,
                                category: mapping.category,
                            },
                        });

                        await syncMappingState(tx, req.accountingId!, mapping.account_code, mapping.category);
                    })
                );

                totalProcessed += batch.length;
            }
        });

        res.json({
            message: 'Mapeamentos DRE compartilhados importados com sucesso',
            count: totalProcessed,
        });
    } catch (error: any) {
        console.error('Erro ao importar mapeamentos DRE:', error);
        res.status(500).json({
            message: 'Erro ao importar mapeamentos DRE',
            detail: error?.message || String(error),
        });
    }
};

import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { getPool } from '../lib/prisma';

const stripAccents = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const VALID_DRE_CATEGORIES = [
    // DRE categories
    'Custos Das Vendas', 'Custos Dos Servicos', 'Deducoes', 'Deducoes De Vendas',
    'Despesas Administrativas', 'Despesas Comerciais', 'Despesas Financeiras',
    'Despesas Tributarias', 'Irpj E Csll', 'Outras Despesas', 'Outras Receitas',
    'Receita Bruta', 'Receitas Financeiras', 'Depreciacao E Amortizacao',
    'Resultado Participacoes Societarias',
    // Patrimonial — Ativo Circulante
    'Adiantamentos', 'Clientes', 'Despesas Antecipadas', 'Disponivel', 'Estoques',
    'Outras Contas A Receber', 'Tributos A CompensarCP',
    // Patrimonial — Ativo Não Circulante
    'Contas A Receber Lp', 'Imobilizado', 'Intangivel', 'Investimentos',
    'Outras Contas A Receber Lp', 'Partes Relacionadas A Receber',
    'Processos Judiciais', 'Tributos A RecuperarLP',
    // Patrimonial — Passivo Circulante
    'Contas A Pagar Cp', 'Emprestimos E Financiamentos Cp', 'Fornecedores',
    'Obrigacoes Trabalhistas', 'Obrigacoes Tributarias', 'Parcelamentos Cp',
    'Processos A Pagar Cp',
    // Patrimonial — Passivo Não Circulante
    'Conta Corrente Dos Socios', 'Emprestimos E Financiamentos Lp',
    'Emprestimos Partes Relacionadas', 'Impostos Diferidos',
    'Outras Contas A Pagar Lp', 'Parcelamentos Lp', 'Processos A Pagar Lp',
    'Provisao Para Contingencias', 'Receita De Exercicio Futuro Lp',
    // Patrimonial — Patrimônio Líquido
    'Capital Social', 'Distribuicao De Lucros', 'Reserva De Capital',
    'Reserva De Lucros', 'Resultado Do Exercicio',
];

const VALID_DRE_CATEGORIES_NORMALIZED = new Set(VALID_DRE_CATEGORIES.map(stripAccents));

const isValidCategory = (category: string) => VALID_DRE_CATEGORIES_NORMALIZED.has(stripAccents(category));

const verifyClientOwnership = async (clientId: string, accountingId: string) => {
    const client = await prisma.client.findFirst({
        where: { id: clientId, accounting_id: accountingId },
        select: { id: true },
    });
    return client !== null;
};

type MappingSyncClient = Pick<typeof prisma, 'chartOfAccounts' | 'monthlyMovement' | 'dREMapping'>;

const syncMappingState = async (
    tx: MappingSyncClient,
    accountingId: string,
    clientId: string,
    accountCode: string,
    category: string | null
) => {
    await tx.chartOfAccounts.updateMany({
        where: {
            accounting_id: accountingId,
            client_id: clientId,
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
            client_id: clientId,
            code: accountCode,
        },
        data: {
            category,
            is_mapped: category !== null,
        },
    });
};

const getClientMappings = async (accountingId: string, clientId: string) => {
    const mappings = await prisma.dREMapping.findMany({
        where: { 
            accounting_id: accountingId,
            client_id: clientId
        },
        orderBy: [{ account_code: 'asc' }, { updated_at: 'desc' }],
    });

    return mappings;
};

export const getDREMappings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente nao encontrado' });
        }

        const mappings = await getClientMappings(req.accountingId, clientId);
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

        if (!isValidCategory(normalizedCategory)) {
            return res.status(400).json({
                message: `Categoria invalida: ${normalizedCategory}. Categorias validas: ${VALID_DRE_CATEGORIES.join(', ')}`,
            });
        }

        const mapping = await prisma.dREMapping.upsert({
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

        // Sync em modo direto evita expiração de interactive transaction em bases maiores.
        await syncMappingState(prisma, req.accountingId!, clientId, accountCode, normalizedCategory);

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

        await prisma.dREMapping.deleteMany({
            where: {
                accounting_id: req.accountingId!,
                client_id: clientId,
                account_code: accountCode,
            },
        });

        const fallback = await prisma.dREMapping.findFirst({
            where: {
                accounting_id: req.accountingId!,
                client_id: clientId,
                account_code: accountCode,
            },
            orderBy: { updated_at: 'desc' },
        });

        await syncMappingState(prisma, req.accountingId!, clientId, accountCode, fallback?.category || null);

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
    console.log('[bulkDRE] === HANDLER V2 CALLED ===');
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

        const normalizedMappings = mappings.map((mapping: any) => ({
            account_code: String(mapping.account_code || '').trim(),
            account_name: String(mapping.account_name || '').trim(),
            category: String(mapping.category || '').trim(),
        }));

        const invalidMappings: string[] = [];
        for (const mapping of normalizedMappings) {
            if (!mapping.account_code || !mapping.account_name || !mapping.category) {
                return res.status(400).json({
                    message: 'Cada mapeamento deve ter account_code, account_name e category',
                });
            }
            if (!isValidCategory(mapping.category)) {
                invalidMappings.push(mapping.category);
            }
        }

        if (invalidMappings.length > 0) {
            console.log('[bulkDRE] Categorias invalidas recebidas:', [...new Set(invalidMappings)]);
            return res.status(400).json({
                message: `Categorias invalidas: ${[...new Set(invalidMappings)].join(', ')}`,
                valid_categories: VALID_DRE_CATEGORIES,
            });
        }

        // Evita conflito de upsert quando o payload traz o mesmo account_code repetido.
        // Regra: o ultimo mapeamento recebido para a conta prevalece.
        const dedupedByAccountCode = new Map<string, { account_code: string; account_name: string; category: string }>();
        for (const mapping of normalizedMappings) {
            dedupedByAccountCode.set(mapping.account_code, mapping);
        }
        const uniqueMappings = Array.from(dedupedByAccountCode.values());

        const accountingId = req.accountingId!;
        console.log(`[bulkDRE] Salvando ${uniqueMappings.length} mapeamentos para client ${clientId}, accountingId: ${accountingId}`);
        console.log(`[bulkDRE] Primeiro mapping:`, JSON.stringify(uniqueMappings[0]));

        // ===== USAR SQL RAW DIRETO (bypassa Prisma transactions) =====
        const pool = getPool();

        // STEP 1: Upsert em batch via SQL (preserva mapeamentos fora do payload)
        let created = 0;
        const batchSize = 50;
        for (let i = 0; i < uniqueMappings.length; i += batchSize) {
            const batch = uniqueMappings.slice(i, i + batchSize);
            const values: any[] = [];
            const placeholders: string[] = [];

            batch.forEach((m: any, idx: number) => {
                const offset = idx * 5;
                placeholders.push(`(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, NOW(), NOW())`);
                values.push(accountingId, clientId, m.account_code, m.account_name, m.category);
            });

            const sql = `INSERT INTO "DREMapping" (id, accounting_id, client_id, account_code, account_name, category, created_at, updated_at)
                         VALUES ${placeholders.join(', ')}
                         ON CONFLICT (client_id, account_code) DO UPDATE SET
                           account_name = EXCLUDED.account_name,
                           category = EXCLUDED.category,
                           updated_at = NOW()`;

            const result = await pool.query(sql, values);
            created += result.rowCount || 0;
        }
        console.log(`[bulkDRE] STEP1 upsert OK: ${created} linhas afetadas`);

        // STEP 2: Sincronizar chart_of_accounts e monthly_movement (best-effort)
        try {
            // Batch update via subquery — 1 query em vez de N
            await pool.query(
                `UPDATE "ChartOfAccounts" ca
                 SET report_category = dm.category, is_mapped = true
                 FROM "DREMapping" dm
                 WHERE ca.accounting_id = $1
                   AND ca.client_id = $2
                   AND dm.accounting_id = $1
                   AND dm.client_id = $2
                   AND ca.code = dm.account_code`,
                [accountingId, clientId]
            );
            await pool.query(
                `UPDATE "MonthlyMovement" mm
                 SET category = dm.category, is_mapped = true
                 FROM "DREMapping" dm
                 WHERE mm.accounting_id = $1
                   AND mm.client_id = $2
                   AND dm.accounting_id = $1
                   AND dm.client_id = $2
                   AND mm.code = dm.account_code`,
                [accountingId, clientId]
            );
            console.log(`[bulkDRE] STEP2 sync OK`);
        } catch (e: any) {
            console.warn('[bulkDRE] STEP2 sync falhou (não-crítico):', e.message);
        }

        console.log(`[bulkDRE] ${created} mapeamentos salvos com sucesso`);

        res.json({
            message: 'Mapeamentos DRE compartilhados importados com sucesso',
            count: created,
        });
    } catch (error: any) {
        console.error('Erro GERAL ao importar mapeamentos DRE:', error.message, error.stack);
        res.status(500).json({
            message: 'Erro ao importar mapeamentos DRE',
            detail: error?.message || String(error),
        });
    }
};


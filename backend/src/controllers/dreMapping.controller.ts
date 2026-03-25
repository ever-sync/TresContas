import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { getPool } from '../lib/prisma';

const stripAccents = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const normalizeCategoryKey = (s: string) =>
    stripAccents(s).replace(/\s+/g, '');

const PATRIMONIAL_CATEGORY_ALIASES: Record<string, string> = {
    disponivel: 'Disponivel',
    clientes: 'Clientes',
    adiantamentos: 'Adiantamentos',
    estoques: 'Estoques',
    'tributos a compensarcp': 'Tributos A CompensarCP',
    'outras contas a receber': 'Outras Contas A Receber',
    'despesas antecipadas': 'Despesas Antecipadas',
    'contas a receber lp': 'Contas A Receber Lp',
    'processos judiciais': 'Processos Judiciais',
    'partes relacionadas a receber': 'Partes Relacionadas A Receber',
    'outras contas a receber lp': 'Outras Contas A Receber Lp',
    'tributos a recuperarlp': 'Tributos A RecuperarLP',
    investimentos: 'Investimentos',
    imobilizado: 'Imobilizado',
    intangivel: 'Intangivel',
    fornecedores: 'Fornecedores',
    'emprestimos e financiamentos cp': 'Emprestimos E Financiamentos Cp',
    'obrigacoes trabalhistas': 'Obrigacoes Trabalhistas',
    'obrigacoes tributarias': 'Obrigacoes Tributarias',
    'contas a pagar cp': 'Contas A Pagar Cp',
    'parcelamentos cp': 'Parcelamentos Cp',
    'processos a pagar cp': 'Processos A Pagar Cp',
    'emprestimos e financiamentos lp': 'Emprestimos E Financiamentos Lp',
    'conta corrente dos socios': 'Conta Corrente Dos Socios',
    'emprestimos partes relacionadas': 'Emprestimos Partes Relacionadas',
    'parcelamentos lp': 'Parcelamentos Lp',
    'processos a pagar lp': 'Processos A Pagar Lp',
    'impostos diferidos': 'Impostos Diferidos',
    'outras contas a pagar lp': 'Outras Contas A Pagar Lp',
    'receita de exercicio futuro lp': 'Receita De Exercicio Futuro Lp',
    'provisao para contingencias': 'Provisao Para Contingencias',
    'capital social': 'Capital Social',
    'reserva de capital': 'Reserva de Capital',
    'reserva de lucros': 'Reserva de Lucros',
    'resultado do exercicio': 'Resultado Do Exercicio',
    'distribuicao de lucros': 'Distribuicao De Lucros',
};

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

const VALID_DRE_CATEGORIES_NORMALIZED = new Set(VALID_DRE_CATEGORIES.map(normalizeCategoryKey));

const isValidCategory = (category: string) => VALID_DRE_CATEGORIES_NORMALIZED.has(normalizeCategoryKey(category));

const resolveCanonicalCategory = (category: string, allowedCategories: string[]) =>
    allowedCategories.find((candidate) => normalizeCategoryKey(candidate) === normalizeCategoryKey(category)) ||
    allowedCategories.find((candidate) => candidate === PATRIMONIAL_CATEGORY_ALIASES[normalizeCategoryKey(category)]) ||
    null;

const GLOBAL_DRE_GROUP_CATEGORIES = {
    dre: VALID_DRE_CATEGORIES.slice(0, 15),
    patrimonial: VALID_DRE_CATEGORIES.slice(15),
} as const;

type GlobalDreGroup = keyof typeof GLOBAL_DRE_GROUP_CATEGORIES;

const isGlobalDreGroup = (value: unknown): value is GlobalDreGroup =>
    value === 'dre' || value === 'patrimonial';

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

const findReferenceClientId = async (accountingId: string) => {
    const clients = await prisma.client.findMany({
        where: { accounting_id: accountingId },
        orderBy: [{ created_at: 'asc' }],
        select: {
            id: true,
            name: true,
        },
    });

    if (clients.length === 0) {
        return null;
    }

    const referenceClient = clients.find((client) => normalizeCategoryKey(client.name).includes('cocacola')) || clients[0];
    return referenceClient.id;
};

const getGlobalMappings = async (accountingId: string) => {
    const pool = getPool();
    const result = await pool.query(
        `SELECT id, accounting_id, client_id, account_code, account_name, category, created_at, updated_at
         FROM "DREMapping"
         WHERE accounting_id = $1
           AND client_id IS NULL
         ORDER BY account_code ASC, updated_at DESC`,
        [accountingId]
    );

    return result.rows;
};

const getReferenceClientMappings = async (accountingId: string) => {
    const referenceClientId = await findReferenceClientId(accountingId);
    if (!referenceClientId) {
        return [];
    }

    return getClientMappings(accountingId, referenceClientId);
};

const syncGlobalMappingState = async (
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
        },
        data: {
            category,
            is_mapped: category !== null,
        },
    });
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

export const getAccountingDREMappings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const mappings = await getGlobalMappings(req.accountingId);
        if (mappings.length > 0) {
            return res.json(mappings);
        }

        const referenceMappings = await getReferenceClientMappings(req.accountingId);
        res.json(referenceMappings);
    } catch (error: any) {
        console.error('Erro ao buscar parametrizacao global DRE:', error);
        res.status(500).json({
            message: 'Erro ao buscar parametrizacao global DRE',
            detail: error?.message || String(error),
        });
    }
};

export const replaceGlobalDREMappings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Nao autorizado' });

        const group: GlobalDreGroup | null = isGlobalDreGroup(req.body?.group)
            ? (req.body.group as GlobalDreGroup)
            : null;
        if (!group) {
            return res.status(400).json({ message: 'group deve ser dre ou patrimonial' });
        }

        const allowedCategories = GLOBAL_DRE_GROUP_CATEGORIES[group];
        const allowedCategoriesNormalized = new Set(allowedCategories.map(normalizeCategoryKey));

        const { mappings } = req.body;
        if (!Array.isArray(mappings)) {
            return res.status(400).json({ message: 'mappings deve ser um array' });
        }

        const normalizedMappings = mappings.map((mapping: any) => ({
            account_code: String(mapping.account_code || '').trim(),
            account_name: String(mapping.account_name || '').trim(),
            category: String(mapping.category || '').trim(),
        }));

        const canonicalMappings: Array<{
            account_code: string;
            account_name: string;
            category: string;
        }> = [];
        const invalidMappings: string[] = [];
        for (const mapping of normalizedMappings) {
            if (!mapping.account_code || !mapping.account_name || !mapping.category) {
                return res.status(400).json({
                    message: 'Cada mapeamento deve ter account_code, account_name e category',
                });
            }

            const canonicalCategory = resolveCanonicalCategory(mapping.category, allowedCategories);
            if (!canonicalCategory || !allowedCategoriesNormalized.has(normalizeCategoryKey(canonicalCategory))) {
                invalidMappings.push(mapping.category);
                continue;
            }

            canonicalMappings.push({
                account_code: mapping.account_code,
                account_name: mapping.account_name,
                category: canonicalCategory,
            });
        }

        if (invalidMappings.length > 0) {
            return res.status(400).json({
                message: `Categorias invalidas para ${group}: ${[...new Set(invalidMappings)].join(', ')}`,
                valid_categories: allowedCategories,
            });
        }

        const dedupedByAccountCode = new Map<string, {
            account_code: string;
            account_name: string;
            category: string;
        }>();
        for (const mapping of canonicalMappings) {
            dedupedByAccountCode.set(mapping.account_code, mapping);
        }
        const uniqueMappings = Array.from(dedupedByAccountCode.values());
        const pool = getPool();
        const db = await pool.connect();

        try {
            await db.query('BEGIN');

            const existingMappingsResult = await db.query<{ account_code: string }>(
                `SELECT account_code
                 FROM "DREMapping"
                 WHERE accounting_id = $1
                   AND client_id IS NULL
                   AND category = ANY($2::text[])`,
                [req.accountingId!, allowedCategories]
            );

            const existingCodes = new Set(existingMappingsResult.rows.map((row) => row.account_code));
            const nextCodes = new Set(uniqueMappings.map((mapping) => mapping.account_code));
            const removedCodes = [...existingCodes].filter((code) => !nextCodes.has(code));

            await db.query(
                `DELETE FROM "DREMapping"
                 WHERE accounting_id = $1
                   AND client_id IS NULL
                   AND category = ANY($2::text[])`,
                [req.accountingId!, allowedCategories]
            );

            if (uniqueMappings.length > 0) {
                const batchSize = 100;
                for (let i = 0; i < uniqueMappings.length; i += batchSize) {
                    const batch = uniqueMappings.slice(i, i + batchSize);
                    const values: any[] = [];
                    const placeholders: string[] = [];

                    batch.forEach((mapping, index) => {
                        const offset = index * 4;
                        placeholders.push(`(gen_random_uuid(), $${offset + 1}, NULL, $${offset + 2}, $${offset + 3}, $${offset + 4}, NOW(), NOW())`);
                        values.push(req.accountingId!, mapping.account_code, mapping.account_name, mapping.category);
                    });

                    await db.query(
                        `INSERT INTO "DREMapping" (id, accounting_id, client_id, account_code, account_name, category, created_at, updated_at)
                         VALUES ${placeholders.join(', ')}`,
                        values
                    );
                }
            }

            if (uniqueMappings.length > 0) {
                await db.query(
                    `UPDATE "ChartOfAccounts" ca
                     SET report_category = dm.category, is_mapped = true
                     FROM "DREMapping" dm
                     WHERE ca.accounting_id = $1
                       AND dm.accounting_id = $1
                       AND dm.client_id IS NULL
                       AND ca.code = dm.account_code`,
                    [req.accountingId!]
                );

                await db.query(
                    `UPDATE "MonthlyMovement" mm
                     SET category = dm.category, is_mapped = true
                     FROM "DREMapping" dm
                     WHERE mm.accounting_id = $1
                       AND dm.accounting_id = $1
                       AND dm.client_id IS NULL
                       AND mm.code = dm.account_code`,
                    [req.accountingId!]
                );
            }

            if (removedCodes.length > 0) {
                await db.query(
                    `UPDATE "ChartOfAccounts"
                     SET report_category = NULL, is_mapped = false
                     WHERE accounting_id = $1
                       AND code = ANY($2::text[])`,
                    [req.accountingId!, removedCodes]
                );

                await db.query(
                    `UPDATE "MonthlyMovement"
                     SET category = NULL, is_mapped = false
                     WHERE accounting_id = $1
                       AND code = ANY($2::text[])`,
                    [req.accountingId!, removedCodes]
                );
            }

            await db.query('COMMIT');
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        } finally {
            db.release();
        }

        res.json({
            message: 'Parametrizacao global salva com sucesso',
            count: uniqueMappings.length,
            group,
        });
    } catch (error: any) {
        console.error('Erro ao salvar parametrizacao global DRE:', error);
        res.status(500).json({
            message: 'Erro ao salvar parametrizacao global DRE',
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
        const canonicalCategory = resolveCanonicalCategory(String(category).trim(), VALID_DRE_CATEGORIES);

        if (!canonicalCategory) {
            return res.status(400).json({
                message: `Categoria invalida: ${String(category).trim()}. Categorias validas: ${VALID_DRE_CATEGORIES.join(', ')}`,
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
                category: canonicalCategory,
                updated_at: new Date(),
            },
            create: {
                accounting_id: req.accountingId!,
                client_id: clientId,
                account_code: accountCode,
                account_name: accountName,
                category: canonicalCategory,
            },
        });

        // Sync em modo direto evita expiração de interactive transaction em bases maiores.
        await syncMappingState(prisma, req.accountingId!, clientId, accountCode, canonicalCategory);

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

        const canonicalMappings: Array<{ account_code: string; account_name: string; category: string }> = [];
        const invalidMappings: string[] = [];
        for (const mapping of mappings as any[]) {
            const account_code = String(mapping.account_code || '').trim();
            const account_name = String(mapping.account_name || '').trim();
            const rawCategory = String(mapping.category || '').trim();

            if (!account_code || !account_name || !rawCategory) {
                return res.status(400).json({
                    message: 'Cada mapeamento deve ter account_code, account_name e category',
                });
            }

            const canonicalCategory = resolveCanonicalCategory(rawCategory, VALID_DRE_CATEGORIES);
            if (!canonicalCategory) {
                invalidMappings.push(rawCategory);
                continue;
            }

            canonicalMappings.push({
                account_code,
                account_name,
                category: canonicalCategory,
            });
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
        for (const mapping of canonicalMappings) {
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


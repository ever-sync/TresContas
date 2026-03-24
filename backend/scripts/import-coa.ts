/**
 * Script manual para importar plano de contas direto no banco
 * Uso: npx ts-node scripts/import-coa.ts
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import path from 'path';
import { resolveDatabaseSslOptions, securityConfig } from '../src/config/security';
import { normalizeDatabaseConnectionString } from '../src/lib/databaseUrl';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.zwrhsvqblidnjjkblzih:Trescon%402025@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require';

const pool = new Pool({
    connectionString: normalizeDatabaseConnectionString(DATABASE_URL, securityConfig.databaseSslMode),
    ssl: resolveDatabaseSslOptions(securityConfig),
    max: 5,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const normalizeHeader = (v: unknown) =>
    String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const isTitleType = (v: unknown) => {
    const n = String(v || 'A').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    return n === 'T' || n === 'S' || n === 'TOTAL' || n.includes('SINT') || n.includes('TIT');
};

async function main() {
    const filePath = path.resolve('C:/Users/rapha/Downloads/plano de contas- geral.xlsx');
    console.log('📂 Lendo arquivo:', filePath);

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const rawHeaders = (data[0] || []).map(normalizeHeader);
    console.log('📋 Headers:', rawHeaders.filter(h => h));

    const rows = data.slice(1);
    console.log(`📊 Total de linhas: ${rows.length}`);

    // Detectar colunas
    const findCol = (aliases: string[]) => {
        const normalized = aliases.map(normalizeHeader);
        return rawHeaders.findIndex(h => h && normalized.some(a => h === a || h.includes(a)));
    };

    const classificacaoCol = findCol(['classificador', 'classificacao']);
    const codigoCol = findCol(['codigo da conta', 'conta contabil', 'codigo contabil', 'codigo']);
    const codeCol = classificacaoCol >= 0 ? classificacaoCol : codigoCol;
    const reducedCodeCol = classificacaoCol >= 0 && codigoCol >= 0 && codigoCol !== classificacaoCol
        ? codigoCol : findCol(['codigo reduzido', 'cod reduzido', 'reduzido']);
    const typeCol = findCol(['tipo']);
    const nameCol = findCol(['descricao', 'nome', 'descricao da conta', 'conta']);
    const aliasCol = findCol(['apelido', 'alias']);
    const reportTypeCol = findCol(['relatorio', 'tipo relatorio']);
    const reportCategoryCol = findCol(['descricao relatorio', 'categoria relatorio', 'categoria']);

    console.log(`🔍 Colunas detectadas: code=${codeCol}, reducedCode=${reducedCodeCol}, name=${nameCol}, type=${typeCol}, alias=${aliasCol}, reportType=${reportTypeCol}, reportCategory=${reportCategoryCol}`);

    const pick = (row: any[], col: number) => col >= 0 ? String(row[col] || '').trim() : '';

    // Processar linhas
    const accounts: any[] = [];
    for (const row of rows) {
        const code = pick(row, codeCol);
        if (!code || !/^\d/.test(code)) continue;

        const name = pick(row, nameCol);
        if (!name) continue;

        const titleType = isTitleType(pick(row, typeCol));
        const reducedCode = pick(row, reducedCodeCol) || null;

        accounts.push({
            code,
            reduced_code: reducedCode,
            name,
            level: code.split('.').length,
            type: titleType ? 'T' : 'A',
            alias: pick(row, aliasCol) || null,
            report_type: pick(row, reportTypeCol) || null,
            report_category: pick(row, reportCategoryCol) || null,
            parent_id: null,
            is_analytic: !titleType,
        });
    }

    console.log(`✅ ${accounts.length} contas válidas processadas`);

    // Deduplicar por code
    const deduped = new Map<string, typeof accounts[number]>();
    for (const acc of accounts) {
        deduped.set(acc.code, acc);
    }
    const unique = Array.from(deduped.values());
    console.log(`🔄 ${unique.length} contas após deduplicação`);

    // Deduplicar reduced_code
    const seenReduced = new Set<string>();
    for (const acc of unique) {
        if (acc.reduced_code) {
            if (seenReduced.has(acc.reduced_code)) {
                acc.reduced_code = null;
            } else {
                seenReduced.add(acc.reduced_code);
            }
        }
    }

    // Buscar accounting_id (pegar o primeiro que existir)
    const accounting = await prisma.accounting.findFirst({ select: { id: true, name: true } });
    if (!accounting) {
        console.error('❌ Nenhuma contabilidade encontrada no banco');
        process.exit(1);
    }
    console.log(`🏢 Contabilidade: ${accounting.name} (${accounting.id})`);

    // Limpar FKs e contas existentes
    const existingIds = (await prisma.chartOfAccounts.findMany({
        where: { accounting_id: accounting.id },
        select: { id: true },
    })).map(a => a.id);

    console.log(`🗑️ ${existingIds.length} contas existentes para limpar`);

    if (existingIds.length > 0) {
        const delItems = await prisma.accountingEntryItem.deleteMany({
            where: { account_id: { in: existingIds } },
        });
        console.log(`  → ${delItems.count} AccountingEntryItems removidos`);

        const delDfc = await prisma.dFCLineMapping.deleteMany({
            where: { accounting_id: accounting.id },
        });
        console.log(`  → ${delDfc.count} DFCLineMappings removidos`);

        const delDre = await prisma.dREMapping.deleteMany({
            where: { accounting_id: accounting.id },
        });
        console.log(`  → ${delDre.count} DREMappings removidos`);

        const delAccounts = await prisma.chartOfAccounts.deleteMany({
            where: { accounting_id: accounting.id },
        });
        console.log(`  → ${delAccounts.count} contas antigas removidas`);
    }

    // Inserir em lotes
    const batchSize = 200;
    let totalCreated = 0;

    for (let i = 0; i < unique.length; i += batchSize) {
        const batch = unique.slice(i, i + batchSize);
        const result = await prisma.chartOfAccounts.createMany({
            data: batch.map(acc => ({
                accounting_id: accounting.id,
                client_id: null,
                ...acc,
            })),
            skipDuplicates: true,
        });
        totalCreated += result.count;
        console.log(`  📦 Lote ${Math.floor(i / batchSize) + 1}: ${result.count} inseridas (total: ${totalCreated})`);
    }

    console.log(`\n🎉 Importação concluída! ${totalCreated} contas inseridas no banco.`);

    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});

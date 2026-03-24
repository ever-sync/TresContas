import prisma from '../lib/prisma';
import {
    DFC_LINE_DEFINITIONS,
    DFC_REPORT_ROWS,
    DFCDisplayType,
    DFCLineDefinition,
    DFCSourceType,
    getDfcLineDefinition,
} from './dfcCatalog';

type ChartAccountRecord = {
    id: string;
    code: string;
    reduced_code: string | null;
    name: string;
    alias?: string | null;
    type: string;
    level: number;
    is_analytic: boolean;
    report_category: string | null;
};

type MovementRecord = {
    code: string;
    reduced_code: string | null;
    name: string;
    level: number;
    category: string | null;
    values: number[];
};

type PersistedMappingRecord = {
    id: string;
    line_key: string;
    chart_account_id: string;
    account_code_snapshot: string;
    reduced_code_snapshot: string | null;
    source_type: string;
    multiplier: number;
    include_children: boolean;
    chart_account: ChartAccountRecord;
};

export interface DFCConfigMappingInput {
    line_key: string;
    chart_account_id: string;
    multiplier?: number;
    include_children?: boolean;
}

export interface DFCEligibleAccount {
    id: string;
    code: string;
    reduced_code: string | null;
    name: string;
    type: string;
    is_analytic: boolean | null;
    level: number;
}

export interface DFCConfigMapping {
    id?: string;
    line_key: string;
    chart_account_id: string;
    account_code_snapshot: string;
    reduced_code_snapshot: string | null;
    source_type: string;
    multiplier: number;
    include_children: boolean;
    chart_account: DFCEligibleAccount;
}

export interface DFCConfigLine extends DFCLineDefinition {
    isDerived: boolean;
}

export interface DFCConfigResponse {
    lines: DFCConfigLine[];
    eligibleAccounts: DFCEligibleAccount[];
    mappings: DFCConfigMapping[];
}

export interface DFCWarning {
    code: string;
    severity: 'info' | 'warning';
    message: string;
    monthIndex?: number;
}

export interface DFCReportLine {
    type: 'section' | 'line' | 'separator';
    key?: string;
    label?: string;
    displayType?: DFCDisplayType;
    values?: Array<number | null>;
    configurable?: boolean;
    isDerived?: boolean;
}

export interface DFCReportResponse {
    year: number;
    partial: boolean;
    warnings: DFCWarning[];
    rows: DFCReportLine[];
}

const TITLE_ACCOUNT_SELECT = {
    id: true,
    code: true,
    reduced_code: true,
    name: true,
    alias: true,
    type: true,
    level: true,
    is_analytic: true,
    report_category: true,
} as const;

const MOVEMENT_SELECT = {
    code: true,
    reduced_code: true,
    name: true,
    level: true,
    category: true,
    values: true,
} as const;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const badRequest = (message: string) => {
    const error = new Error(message) as Error & { status?: number };
    error.status = 400;
    return error;
};

const normalizeAccountType = (type: string) =>
    type
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

const looksLikeHierarchicalCode = (value: string | null | undefined) =>
    /^\d+(?:\.\d+)+$/.test(String(value || '').trim());

const looksLikeTitleMarker = (value: string | null | undefined) => {
    const normalized = normalizeAccountType(String(value || 'A'));
    return (
        normalized === 'T' ||
        normalized === 'S' ||
        normalized === 'TOTAL' ||
        normalized.includes('SINT') ||
        normalized.includes('TIT')
    );
};

const getEffectiveAccountCode = (account: ChartAccountRecord) => {
    if (looksLikeHierarchicalCode(account.code)) {
        return account.code.trim();
    }

    if (looksLikeHierarchicalCode(account.name)) {
        return account.name.trim();
    }

    return account.code.trim();
};

const getEffectiveAccountName = (account: ChartAccountRecord) => {
    if (looksLikeHierarchicalCode(account.name) && account.report_category && account.alias) {
        return account.alias.trim();
    }

    return account.name.trim();
};

const getEffectiveAccountLevel = (account: ChartAccountRecord) => {
    const code = getEffectiveAccountCode(account);
    if (looksLikeHierarchicalCode(code)) {
        return code.split('.').length;
    }

    return account.level;
};

const isDescendantCode = (parentCode: string, candidateCode: string) =>
    candidateCode === parentCode || candidateCode.startsWith(`${parentCode}.`);

const hasDescendantAccount = (account: ChartAccountRecord, accounts: ChartAccountRecord[]) =>
    accounts.some(
        (candidate) =>
            candidate.id !== account.id &&
            isDescendantCode(getEffectiveAccountCode(account), getEffectiveAccountCode(candidate))
    );

const hasMalformedChartLayout = (accounts: ChartAccountRecord[]) =>
    accounts.length > 0 &&
    accounts.every(
        (account) =>
            normalizeAccountType(account.type || 'A') === 'A' &&
            account.is_analytic === true
    );

const isTitleAccount = (account: ChartAccountRecord, accounts: ChartAccountRecord[]) => {
    const normalizedType = normalizeAccountType(account.type || 'A');
    const malformedLayout = hasMalformedChartLayout(accounts);
    return (
        normalizedType === 'T' ||
        normalizedType === 'S' ||
        normalizedType === 'TOTAL' ||
        normalizedType.includes('SINT') ||
        normalizedType.includes('TIT') ||
        looksLikeTitleMarker(account.name) ||
        account.is_analytic === false ||
        hasDescendantAccount(account, accounts) ||
        (malformedLayout && !!getEffectiveAccountCode(account))
    );
};

const getAccountBucket = (code: string): 'dre' | 'asset' | 'liability' | 'equity' | 'unknown' => {
    const normalizedCode = code.trim();
    if (normalizedCode.startsWith('01')) return 'asset';
    if (normalizedCode.startsWith('02.4')) return 'equity';
    if (normalizedCode.startsWith('02')) return 'liability';
    if (normalizedCode.startsWith('03') || normalizedCode.startsWith('04')) return 'dre';
    return 'unknown';
};

const isAccountCompatibleWithSourceType = (account: ChartAccountRecord, sourceType: DFCSourceType) => {
    const bucket = getAccountBucket(getEffectiveAccountCode(account));
    if (sourceType === 'cash') return bucket === 'asset';
    if (sourceType === 'equity') return bucket === 'equity';
    return bucket === sourceType;
};

const isNumericCode = (code: string) => /^\d/.test(code.trim());

const getMonthValue = (values: number[], monthIdx: number) => values[monthIdx] || 0;

const getLeafMovementsForCode = (
    movements: MovementRecord[],
    accountCode: string,
    includeChildren: boolean
) => {
    const numericMovements = movements.filter((movement) => isNumericCode(movement.code));
    if (!includeChildren) {
        return numericMovements.filter((movement) => movement.code === accountCode);
    }

    const matched = numericMovements.filter((movement) => isDescendantCode(accountCode, movement.code));
    return matched.filter(
        (movement) =>
            !matched.some(
                (candidate) =>
                    candidate.code !== movement.code &&
                    candidate.code.startsWith(`${movement.code}.`)
            )
    );
};

const getRawBalanceForMapping = (
    mapping: PersistedMappingRecord,
    movements: MovementRecord[],
    monthIdx: number
) =>
    round2(
        getLeafMovementsForCode(movements, mapping.account_code_snapshot, mapping.include_children)
            .reduce((sum, movement) => sum + getMonthValue(movement.values, monthIdx), 0)
    );

const getSignedDeltaForMapping = (
    mapping: PersistedMappingRecord,
    currentYearMovements: MovementRecord[],
    previousYearMovements: MovementRecord[],
    monthIdx: number
) => {
    const currentClosing = getRawBalanceForMapping(mapping, currentYearMovements, monthIdx);
    const openingBalance = getRawBalanceForMapping(mapping, previousYearMovements, 11);
    const delta = currentClosing - openingBalance;

    if (mapping.source_type === 'asset' || mapping.source_type === 'cash') {
        return round2(-delta * mapping.multiplier);
    }
    return round2(delta * mapping.multiplier);
};

const getDreValueForMapping = (
    mapping: PersistedMappingRecord,
    dreMovements: MovementRecord[],
    monthIdx: number
) =>
    round2(
        getLeafMovementsForCode(dreMovements, mapping.account_code_snapshot, mapping.include_children)
            .reduce((sum, movement) => sum + getMonthValue(movement.values, monthIdx), 0) * mapping.multiplier
    );

const sumNullableValues = (...values: Array<number | null>) => {
    if (values.some((value) => value === null)) return null;
    return round2((values as number[]).reduce((sum, value) => sum + value, 0));
};

const buildMonthlyArray = (factory: (monthIdx: number) => number | null) =>
    Array.from({ length: 12 }, (_, monthIdx) => factory(monthIdx));

const toEligibleAccount = (account: ChartAccountRecord): DFCEligibleAccount => ({
    id: account.id,
    code: getEffectiveAccountCode(account),
    reduced_code: account.reduced_code,
    name: getEffectiveAccountName(account),
    type: account.type,
    is_analytic: account.is_analytic,
    level: getEffectiveAccountLevel(account),
});

const toConfigMapping = (mapping: PersistedMappingRecord): DFCConfigMapping => ({
    id: mapping.id,
    line_key: mapping.line_key,
    chart_account_id: mapping.chart_account_id,
    account_code_snapshot: mapping.account_code_snapshot,
    reduced_code_snapshot: mapping.reduced_code_snapshot,
    source_type: mapping.source_type,
    multiplier: mapping.multiplier,
    include_children: mapping.include_children,
    chart_account: toEligibleAccount(mapping.chart_account),
});

const toConfigLine = (line: DFCLineDefinition): DFCConfigLine => ({
    ...line,
    isDerived: !line.configurable,
});

const getMappingsByLine = (mappings: PersistedMappingRecord[]) =>
    mappings.reduce<Record<string, PersistedMappingRecord[]>>((acc, mapping) => {
        if (!acc[mapping.line_key]) acc[mapping.line_key] = [];
        acc[mapping.line_key].push(mapping);
        return acc;
    }, {});

const calculateConfiguredLineValues = (
    line: DFCLineDefinition,
    mappings: PersistedMappingRecord[],
    dreMovements: MovementRecord[],
    patrimonialMovements: MovementRecord[],
    priorYearPatrimonialMovements: MovementRecord[],
    hasPriorYearBase: boolean
) => {
    if (mappings.length === 0) {
        return Array(12).fill(0) as Array<number | null>;
    }

    if (line.sourceType === 'dre') {
        return buildMonthlyArray((monthIdx) =>
            round2(
                mappings.reduce(
                    (sum, mapping) => sum + getDreValueForMapping(mapping, dreMovements, monthIdx),
                    0
                )
            )
        );
    }

    if (!hasPriorYearBase) {
        return Array(12).fill(null);
    }

    return buildMonthlyArray((monthIdx) =>
        round2(
            mappings.reduce(
                (sum, mapping) =>
                    sum +
                    getSignedDeltaForMapping(
                        mapping,
                        patrimonialMovements,
                        priorYearPatrimonialMovements,
                        monthIdx
                    ),
                0
            )
        )
    );
};

export const getDfcConfig = async (clientId: string, accountingId: string): Promise<DFCConfigResponse> => {
    const [accounts, mappings] = await Promise.all([
        prisma.chartOfAccounts.findMany({
            where: { accounting_id: accountingId },
            orderBy: [{ code: 'asc' }],
            select: TITLE_ACCOUNT_SELECT,
        }),
        prisma.dFCLineMapping.findMany({
            where: { client_id: clientId },
            orderBy: [{ line_key: 'asc' }, { account_code_snapshot: 'asc' }],
            include: {
                chart_account: {
                    select: TITLE_ACCOUNT_SELECT,
                },
            },
        }),
    ]);

    return {
        lines: DFC_LINE_DEFINITIONS
            .slice()
            .sort((a, b) => a.order - b.order)
            .map(toConfigLine),
        eligibleAccounts: accounts
            .map(toEligibleAccount)
            .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true })),
        mappings: mappings.map((mapping) => toConfigMapping(mapping as PersistedMappingRecord)),
    };
};

export const saveDfcConfig = async (
    clientId: string,
    accountingId: string,
    mappingsInput: DFCConfigMappingInput[]
) => {
    const lineKeys = new Set(DFC_LINE_DEFINITIONS.filter((line) => line.configurable).map((line) => line.key));

    const accounts = await prisma.chartOfAccounts.findMany({
        where: {
            accounting_id: accountingId,
        },
        select: TITLE_ACCOUNT_SELECT,
    });

    const accountsById = new Map(accounts.map((account) => [account.id, account as ChartAccountRecord]));
    const dedupe = new Set<string>();
    const payload = mappingsInput.map((mapping) => {
        if (!lineKeys.has(mapping.line_key)) {
            throw badRequest(`Linha DFC inválida para configuração: ${mapping.line_key}`);
        }

        const lineDefinition = getDfcLineDefinition(mapping.line_key);
        if (!lineDefinition?.configurable || !lineDefinition.sourceType) {
            throw badRequest(`Linha DFC não configurável: ${mapping.line_key}`);
        }

        const account = accountsById.get(mapping.chart_account_id);
        if (!account) {
            throw badRequest(`Conta nao encontrada no plano compartilhado: ${mapping.chart_account_id}`);
        }
        const effectiveCode = getEffectiveAccountCode(account);
        if (!isAccountCompatibleWithSourceType(account, lineDefinition.sourceType)) {
            throw badRequest(`A conta ${effectiveCode} não é compatível com a linha ${lineDefinition.label}.`);
        }

        const dedupeKey = `${mapping.line_key}::${mapping.chart_account_id}`;
        if (dedupe.has(dedupeKey)) {
            throw badRequest(`A conta ${effectiveCode} foi repetida na linha ${lineDefinition.label}.`);
        }
        dedupe.add(dedupeKey);

        return {
            accounting_id: accountingId,
            client_id: clientId,
            line_key: mapping.line_key,
            chart_account_id: account.id,
            account_code_snapshot: effectiveCode,
            reduced_code_snapshot: account.reduced_code,
            source_type: lineDefinition.sourceType,
            multiplier: Number.isFinite(mapping.multiplier) ? Number(mapping.multiplier) : (lineDefinition.defaultMultiplier || 1),
            include_children: mapping.include_children ?? lineDefinition.includeChildrenByDefault ?? true,
        };
    });

    await prisma.$transaction([
        prisma.dFCLineMapping.deleteMany({
            where: { client_id: clientId },
        }),
        prisma.dFCLineMapping.createMany({
            data: payload,
            skipDuplicates: true,
        }),
    ]);

    return getDfcConfig(clientId, accountingId);
};

export const getDfcReport = async (clientId: string, year: number): Promise<DFCReportResponse> => {
    const [mappings, dreMovements, patrimonialMovements, priorYearPatrimonialMovements] = await Promise.all([
        prisma.dFCLineMapping.findMany({
            where: { client_id: clientId },
            orderBy: [{ line_key: 'asc' }, { account_code_snapshot: 'asc' }],
            include: {
                chart_account: {
                    select: TITLE_ACCOUNT_SELECT,
                },
            },
        }),
        prisma.monthlyMovement.findMany({
            where: { client_id: clientId, year, type: 'dre' },
            orderBy: { code: 'asc' },
            select: MOVEMENT_SELECT,
        }),
        prisma.monthlyMovement.findMany({
            where: { client_id: clientId, year, type: 'patrimonial' },
            orderBy: { code: 'asc' },
            select: MOVEMENT_SELECT,
        }),
        prisma.monthlyMovement.findMany({
            where: { client_id: clientId, year: year - 1, type: 'patrimonial' },
            orderBy: { code: 'asc' },
            select: MOVEMENT_SELECT,
        }),
    ]);

    const warnings: DFCWarning[] = [];
    const mappingsByLine = getMappingsByLine(mappings as PersistedMappingRecord[]);
    const totalMappings = mappings.length;
    const hasPriorYearBase = priorYearPatrimonialMovements.some((movement) => isNumericCode(movement.code));

    if (totalMappings === 0) {
        warnings.push({
            code: 'missing_configuration',
            severity: 'warning',
            message: 'A DFC ainda não possui contas-título configuradas para este cliente.',
        });
    }

    if (!hasPriorYearBase) {
        warnings.push({
            code: 'missing_prior_year_base',
            severity: 'warning',
            message: `Não foi encontrado patrimonial bruto de dezembro de ${year - 1}. A DFC foi marcada como parcial.`,
        });
    }

    const lineValues = new Map<string, Array<number | null>>();

    for (const line of DFC_LINE_DEFINITIONS) {
        if (!line.configurable || line.sourceType === 'cash') continue;
        const mappingsForLine = mappingsByLine[line.key] || [];
        lineValues.set(
            line.key,
            calculateConfiguredLineValues(
                line,
                mappingsForLine,
                dreMovements as MovementRecord[],
                patrimonialMovements as MovementRecord[],
                priorYearPatrimonialMovements as MovementRecord[],
                hasPriorYearBase
            )
        );
    }

    const lucroAjustadoKeys = [
        'resultadoLiquidoExercicio',
        'depreciacaoAmortizacao',
        'resultadoVendaAtivoImobilizado',
        'resultadoEquivalenciaPatrimonial',
        'recebimentosLucrosDividendosSubsidiarias',
    ];
    const variacaoAtivoKeys = [
        'contasAReceber',
        'adiantamentos',
        'impostosCompensar',
        'estoques',
        'despesasAntecipadas',
        'outrasContasReceber',
    ];
    const variacaoPassivoKeys = [
        'fornecedores',
        'obrigacoesTrabalhistas',
        'obrigacoesTributarias',
        'outrasObrigacoes',
        'parcelamentos',
    ];
    const investimentoKeys = [
        'recebimentosVendasAtivo',
        'comprasImobilizado',
        'aquisicoesInvestimentos',
        'baixaAtivoImobilizado',
    ];
    const financiamentoKeys = [
        'integralizacaoCapitalSocial',
        'pagamentoLucrosDividendos',
        'variacaoEmprestimosFinanciamentos',
        'dividendosProvisionadosPagar',
        'variacaoEmprestimosPessoasLigadas',
    ];

    const deriveLine = (targetKey: string, keys: string[]) => {
        lineValues.set(
            targetKey,
            buildMonthlyArray((monthIdx) =>
                sumNullableValues(
                    ...keys.map((key) => lineValues.get(key)?.[monthIdx] ?? 0)
                )
            )
        );
    };

    deriveLine('lucroAjustado', lucroAjustadoKeys);
    deriveLine('variacaoAtivo', variacaoAtivoKeys);
    deriveLine('variacaoPassivo', variacaoPassivoKeys);
    deriveLine('resultadoOperacional', ['lucroAjustado', 'variacaoAtivo', 'variacaoPassivo']);
    deriveLine('resultadoInvestimento', investimentoKeys);
    deriveLine('resultadoFinanceiro', financiamentoKeys);

    const cashMappings = mappingsByLine.disponibilidadesBase || [];
    const hasCashMappings = cashMappings.length > 0;
    if (!hasCashMappings) {
        warnings.push({
            code: 'missing_cash_mapping',
            severity: 'warning',
            message: 'Configure a linha de disponibilidades base para obter saldo inicial/final disponível e conciliação.',
        });
    }

    const saldoInicialDisponivel = hasCashMappings && hasPriorYearBase
        ? buildMonthlyArray(() =>
            round2(
                cashMappings.reduce(
                    (sum, mapping) =>
                        sum +
                        getRawBalanceForMapping(
                            mapping as PersistedMappingRecord,
                            priorYearPatrimonialMovements as MovementRecord[],
                            11
                        ),
                    0
                )
            )
        )
        : Array(12).fill(null);

    const saldoFinalDisponivel = hasCashMappings
        ? buildMonthlyArray((monthIdx) =>
            round2(
                cashMappings.reduce(
                    (sum, mapping) =>
                        sum +
                        getRawBalanceForMapping(
                            mapping as PersistedMappingRecord,
                            patrimonialMovements as MovementRecord[],
                            monthIdx
                        ),
                    0
                )
            )
        )
        : Array(12).fill(null);

    lineValues.set('saldoInicialDisponivel', saldoInicialDisponivel);
    lineValues.set('saldoFinalDisponivel', saldoFinalDisponivel);
    deriveLine('resultadoGeracaoCaixa', [
        'resultadoOperacional',
        'resultadoInvestimento',
        'resultadoFinanceiro',
    ]);

    const resultadoGeracaoCaixa = lineValues.get('resultadoGeracaoCaixa') || Array(12).fill(null);
    for (let monthIdx = 0; monthIdx < 12; monthIdx += 1) {
        const opening = saldoInicialDisponivel[monthIdx];
        const closing = saldoFinalDisponivel[monthIdx];
        const generated = resultadoGeracaoCaixa[monthIdx];
        if (opening === null || closing === null || generated === null) continue;

        const expected = round2(closing - opening);
        if (Math.abs(expected - generated) > 0.01) {
            warnings.push({
                code: 'reconciliation_mismatch',
                severity: 'warning',
                monthIndex: monthIdx,
                message: `A reconciliação da DFC não fechou para o mês ${monthIdx + 1}: esperado ${expected.toFixed(2)} e calculado ${generated.toFixed(2)}.`,
            });
        }
    }

    const rows: DFCReportLine[] = DFC_REPORT_ROWS.map((row) => {
        if (row.type !== 'line' || !row.key) {
            return {
                type: row.type,
                label: row.label,
            };
        }

        const lineDefinition = getDfcLineDefinition(row.key);
        return {
            type: 'line',
            key: row.key,
            label: lineDefinition?.label || row.key,
            displayType: lineDefinition?.displayType || 'item',
            values: lineValues.get(row.key) || Array(12).fill(0),
            configurable: lineDefinition?.configurable || false,
            isDerived: lineDefinition ? !lineDefinition.configurable : false,
        };
    });

    const partial =
        warnings.some((warning) => warning.code !== 'reconciliation_mismatch') ||
        rows.some(
            (row) =>
                row.type === 'line' &&
                (row.values || []).some((value) => value === null)
        );

    return {
        year,
        partial,
        warnings,
        rows,
    };
};

import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    chartOfAccountsService,
    type ChartAccount,
    type ImportAccount,
} from '../services/chartOfAccountsService';

interface ChartOfAccountsManagerProps {
    searchTerm?: string;
}

const normalizeSpreadsheetHeader = (value: unknown) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const findSpreadsheetColumn = (headers: string[], aliases: string[]) => {
    const normalizedAliases = aliases.map(normalizeSpreadsheetHeader);
    return headers.findIndex((header) => {
        if (!header) return false;
        return normalizedAliases.some((alias) => header === alias || header.includes(alias));
    });
};

const looksLikeAccountClassifier = (value: unknown) =>
    /^\d+(?:\.\d+)+$/.test(String(value || '').trim());

const looksLikeReducedAccountCode = (value: unknown) =>
    /^\d+$/.test(String(value || '').trim());

const normalizeAccountType = (value: unknown) =>
    String(value || 'A')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

const isTitleType = (value: unknown) => {
    const normalized = normalizeAccountType(value);
    return (
        normalized === 'T' ||
        normalized === 'S' ||
        normalized === 'TOTAL' ||
        normalized.includes('SINT') ||
        normalized.includes('TIT')
    );
};

export const ChartOfAccountsManager = ({
    searchTerm = '',
}: ChartOfAccountsManagerProps) => {
    const [accounts, setAccounts] = useState<ChartAccount[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAccounts = async () => {
        try {
            setLoading(true);
            const data = await chartOfAccountsService.getSharedAll();
            setAccounts(data);
        } catch (error) {
            console.error('Erro ao carregar plano de contas compartilhado:', error);
            toast.error('Erro ao carregar plano de contas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    const filteredAccounts = useMemo(() => {
        const normalizedSearch = searchTerm.toLowerCase();
        if (!normalizedSearch) return accounts;
        return accounts.filter((account) =>
            account.code.includes(searchTerm) ||
            account.name.toLowerCase().includes(normalizedSearch) ||
            (account.alias || '').toLowerCase().includes(normalizedSearch)
        );
    }, [accounts, searchTerm]);

    const handleImportPlanoDeContas = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
            try {
                const fileContent = loadEvent.target?.result;
                const workbook = XLSX.read(fileContent, { type: 'binary' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | undefined)[][];

                const rawHeaders = (data[0] || []).map(normalizeSpreadsheetHeader);
                const rows = data.slice(1);

                // Prioridade: 'classificacao' é o código hierárquico (01.1.01.01.0001)
                // 'codigo' sozinho pode ser o numérico/reduzido (10000)
                const classificacaoColumn = findSpreadsheetColumn(rawHeaders, [
                    'classificador',
                    'classificacao',
                ]);
                const codigoColumn = findSpreadsheetColumn(rawHeaders, [
                    'codigo da conta',
                    'conta contabil',
                    'codigo contabil',
                    'codigo',
                ]);
                // Se achou 'classificacao', ele é o code; 'codigo' vira reduced_code
                // Se só achou 'codigo', ele é o code
                const codeColumn = classificacaoColumn >= 0 ? classificacaoColumn : codigoColumn;
                const reducedCodeColumn = classificacaoColumn >= 0 && codigoColumn >= 0 && codigoColumn !== classificacaoColumn
                    ? codigoColumn
                    : findSpreadsheetColumn(rawHeaders, [
                        'codigo reduzido',
                        'cod reduzido',
                        'reduzido',
                        'reduced_code',
                    ]);
                const levelColumn = findSpreadsheetColumn(rawHeaders, ['nivel']);
                const typeColumn = findSpreadsheetColumn(rawHeaders, ['tipo']);
                const nameColumn = findSpreadsheetColumn(rawHeaders, [
                    'descricao',
                    'nome',
                    'descricao da conta',
                    'conta',
                ]);
                const aliasColumn = findSpreadsheetColumn(rawHeaders, ['apelido', 'alias']);
                const reportTypeColumn = findSpreadsheetColumn(rawHeaders, [
                    'relatorio',
                    'tipo relatorio',
                    'report_type',
                ]);
                const reportCategoryColumn = findSpreadsheetColumn(rawHeaders, [
                    'descricao relatorio',
                    'categoria relatorio',
                    'report_category',
                    'categoria',
                ]);

                const importAccounts = rows
                    .map<ImportAccount | null>((row) => {
                        const cells = row.map((cell) => String(cell || '').trim());
                        const pickColumnValue = (columnIndex: number) =>
                            columnIndex >= 0 ? cells[columnIndex] || '' : '';

                        const inferredCode = cells.find(looksLikeAccountClassifier) || '';
                        const rawCode = pickColumnValue(codeColumn) || inferredCode;
                        if (!rawCode || !/^\d/.test(rawCode)) {
                            return null;
                        }

                        const inferredReducedCode = cells.find((cell) =>
                            looksLikeReducedAccountCode(cell) && cell !== rawCode
                        );
                        const reducedCode = pickColumnValue(reducedCodeColumn) || inferredReducedCode || undefined;

                        const rawAlias = pickColumnValue(aliasColumn);
                        const rawName = pickColumnValue(nameColumn);
                        const fallbackName = cells.find((cell) =>
                            Boolean(cell) &&
                            cell !== rawCode &&
                            cell !== reducedCode &&
                            !looksLikeAccountClassifier(cell) &&
                            !looksLikeReducedAccountCode(cell) &&
                            !isTitleType(cell)
                        ) || '';
                        const name = [rawName, rawAlias, fallbackName].find((value) => value && value !== rawCode) || '';

                        const explicitLevel = parseInt(pickColumnValue(levelColumn), 10);
                        const level = Number.isFinite(explicitLevel) && explicitLevel > 0
                            ? explicitLevel
                            : rawCode.split('.').length;

                        const inferredType = cells.find((cell) => isTitleType(cell));

                        return {
                            code: rawCode,
                            reduced_code: reducedCode,
                            name,
                            level,
                            type: isTitleType(pickColumnValue(typeColumn) || inferredType) ? 'T' : 'A',
                            alias: rawAlias || undefined,
                            report_type: pickColumnValue(reportTypeColumn) || undefined,
                            report_category: pickColumnValue(reportCategoryColumn) || undefined,
                        };
                    })
                    .filter((account): account is ImportAccount => Boolean(account && account.code && account.name));

                if (importAccounts.length === 0) {
                    toast.error('Nenhuma conta encontrada no arquivo');
                    return;
                }

                toast.loading(`Importando ${importAccounts.length} contas...`, { id: 'import-shared-coa' });
                const result = await chartOfAccountsService.bulkImportShared(importAccounts);
                toast.success(`${result.count} contas importadas com sucesso!`, { id: 'import-shared-coa' });
                await loadAccounts();
            } catch (error: unknown) {
                console.error('Erro ao importar plano de contas:', error);
                const msg = axios.isAxiosError(error)
                    ? error.response?.data?.message || error.response?.data?.detail || 'Erro ao importar plano de contas'
                    : 'Erro ao importar plano de contas';
                toast.error(msg, { id: 'import-shared-coa' });
            }
        };

        reader.readAsBinaryString(file);
        event.target.value = '';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white">Plano de Contas</h2>
                    <p className="text-slate-400">Plano compartilhado do escritorio para todos os clientes</p>
                </div>
                <label className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium cursor-pointer">
                    <Upload className="w-5 h-5" />
                    Importar Plano de Contas
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleImportPlanoDeContas} />
                </label>
            </div>

            <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Plano compartilhado</h3>
                    <span className="text-xs text-slate-500">{accounts.length} contas</span>
                </div>

                {loading ? (
                    <div className="p-16 flex items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Carregando plano de contas...
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="p-16 text-center">
                        <FileSpreadsheet className="w-16 h-16 text-white/10 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-white/40 mb-2">Nenhum plano de contas</h4>
                        <p className="text-sm text-white/20">Importe um arquivo CSV ou XLSX com o plano compartilhado do escritorio</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[#0a1628] border-b border-white/10">
                                    <th className="p-4 px-6 text-xs font-bold text-white/60 uppercase tracking-wider min-w-[180px]">Código</th>
                                    <th className="p-4 px-3 text-xs font-bold text-white/60 uppercase tracking-wider min-w-[50px]">Cód. Red.</th>
                                    <th className="p-4 px-3 text-xs font-bold text-white/60 uppercase tracking-wider min-w-[50px]">Nív</th>
                                    <th className="p-4 px-3 text-xs font-bold text-white/60 uppercase tracking-wider min-w-[60px]">Tipo</th>
                                    <th className="p-4 px-6 text-xs font-bold text-white/60 uppercase tracking-wider min-w-[320px]">Descrição</th>
                                    <th className="p-4 px-3 text-xs font-bold text-white/60 uppercase tracking-wider min-w-[120px]">Apelido</th>
                                    <th className="p-4 px-3 text-xs font-bold text-white/60 uppercase tracking-wider min-w-[140px]">Relatório</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredAccounts.map((item) => {
                                    const isTotalizador = item.type === 'T' || item.is_analytic === false;
                                    return (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-white/[0.06] transition-colors ${
                                                item.level === 1 ? 'bg-white/[0.08] font-bold text-white' :
                                                isTotalizador ? 'bg-white/[0.03] font-semibold text-white/90' : 'text-white/70'
                                            }`}
                                        >
                                            <td className="p-3 px-6 text-sm font-mono text-cyan-400">{item.code}</td>
                                            <td className="p-3 px-3 text-sm font-mono text-white/50 text-center">{item.reduced_code || '-'}</td>
                                            <td className="p-3 px-3 text-sm text-center text-white/50">{item.level}</td>
                                            <td className="p-3 px-3 text-sm text-center">
                                                {isTotalizador ? (
                                                    <span className="px-2.5 py-1 bg-cyan-500/15 text-cyan-300 rounded-md text-xs font-bold">T</span>
                                                ) : (
                                                    <span className="text-white/40 text-xs">A</span>
                                                )}
                                            </td>
                                            <td className="p-3 px-6 text-sm">
                                                <div style={{ paddingLeft: `${Math.min((item.level - 1) * 12, 96)}px` }}>
                                                    {item.name}
                                                </div>
                                            </td>
                                            <td className="p-3 px-3 text-sm text-white/50">{item.alias || '-'}</td>
                                            <td className="p-3 px-3 text-sm text-white/50">{item.report_type || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChartOfAccountsManager;

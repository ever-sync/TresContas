import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ChevronDown,
    Download,
    Loader2,
    Plus,
    Save,
    Settings2,
    Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchableAccountSelect, type AccountOption } from './SearchableAccountSelect';
import {
    clientPortalDfcService,
    dfcService,
} from '../services/dfcService';
import type {
    DFCEligibleAccount,
    DFCConfigLine,
    DFCConfigResponse,
    DFCDisplayType,
    DFCReportResponse,
} from '../services/dfcService';

const formatLocaleNumber = (number: number) =>
    Math.abs(number).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

type DraftMapping = {
    localId: string;
    line_key: string;
    chart_account_id: string;
    multiplier: number;
    include_children: boolean;
};

interface ClientDfcSectionProps {
    clientId?: string;
    isAccountingView: boolean;
    selectedYear: number;
    selectedMonthIndex: number;
    months: string[];
    reportRef: React.RefObject<HTMLDivElement | null>;
    onExport: () => void;
}

const SECTION_LABELS: Record<string, string> = {
    resultado_contabil: 'Resultado Contábil',
    variacao_ativo: 'Variação Ativo',
    variacao_passivo: 'Variação Passivo',
    investimentos: 'Investimentos',
    financiamentos: 'Financiamentos',
    base_caixa: 'Base de Caixa',
    operacional: 'Operacional',
    geracao_caixa: 'Geração de Caixa',
};

const makeLocalId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getAccountBucket = (code: string): 'dre' | 'asset' | 'liability' | 'equity' | 'unknown' => {
    const normalizedCode = code.trim();
    if (normalizedCode.startsWith('01')) return 'asset';
    if (normalizedCode.startsWith('02.4')) return 'equity';
    if (normalizedCode.startsWith('02')) return 'liability';
    if (normalizedCode.startsWith('03') || normalizedCode.startsWith('04')) return 'dre';
    return 'unknown';
};

const isAccountCompatibleWithLine = (account: DFCEligibleAccount, line: DFCConfigLine) => {
    if (!line.sourceType) return true;
    const bucket = getAccountBucket(account.code);
    if (line.sourceType === 'cash') return bucket === 'asset';
    if (line.sourceType === 'equity') return bucket === 'equity';
    return bucket === line.sourceType;
};

export const ClientDfcSection = ({
    clientId,
    isAccountingView,
    selectedYear,
    selectedMonthIndex,
    months,
    reportRef,
    onExport,
}: ClientDfcSectionProps) => {
    const [mode, setMode] = useState<'view' | 'config'>('view');
    const [report, setReport] = useState<DFCReportResponse | null>(null);
    const [config, setConfig] = useState<DFCConfigResponse | null>(null);
    const [draftMappings, setDraftMappings] = useState<DraftMapping[]>([]);
    const [loadingReport, setLoadingReport] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const loadReport = async () => {
            try {
                setLoadingReport(true);
                const data = isAccountingView && clientId
                    ? await dfcService.getReport(clientId, selectedYear)
                    : await clientPortalDfcService.getReport(selectedYear);
                setReport(data);
            } catch (error) {
                console.error('Erro ao carregar DFC:', error);
                toast.error('Erro ao carregar DFC');
            } finally {
                setLoadingReport(false);
            }
        };

        if ((isAccountingView && clientId) || !isAccountingView) {
            loadReport();
        }
    }, [clientId, isAccountingView, selectedYear]);

    useEffect(() => {
        if (!isAccountingView || !clientId) return;

        const loadConfig = async () => {
            try {
                setLoadingConfig(true);
                const data = await dfcService.getConfig(clientId);
                setConfig(data);
            } catch (error) {
                console.error('Erro ao carregar configuração DFC:', error);
                toast.error('Erro ao carregar configuração DFC');
            } finally {
                setLoadingConfig(false);
            }
        };

        loadConfig();
    }, [clientId, isAccountingView]);

    useEffect(() => {
        if (!config) return;
        setDraftMappings(
            config.mappings.map((mapping) => ({
                localId: mapping.id || makeLocalId(),
                line_key: mapping.line_key,
                chart_account_id: mapping.chart_account_id,
                multiplier: mapping.multiplier,
                include_children: mapping.include_children,
            }))
        );
    }, [config]);

    const configLines = useMemo(
        () =>
            (config?.lines || [])
                .filter((line) => line.configurable)
                .sort((a, b) => a.order - b.order),
        [config]
    );

    const eligibleAccounts = useMemo(() => config?.eligibleAccounts || [], [config?.eligibleAccounts]);
    const accountsById = useMemo(
        () => new Map(eligibleAccounts.map((account) => [account.id, account])),
        [eligibleAccounts]
    );

    const mappingsByLine = useMemo(
        () =>
            draftMappings.reduce<Record<string, DraftMapping[]>>((acc, mapping) => {
                if (!acc[mapping.line_key]) acc[mapping.line_key] = [];
                acc[mapping.line_key].push(mapping);
                return acc;
            }, {}),
        [draftMappings]
    );

    const groupedConfigLines = useMemo(() => {
        return configLines.reduce<Record<string, DFCConfigLine[]>>((acc, line) => {
            if (!acc[line.section]) acc[line.section] = [];
            acc[line.section].push(line);
            return acc;
        }, {});
    }, [configLines]);

    const getEligibleAccountsForLine = (line: DFCConfigLine) =>
        eligibleAccounts.filter((account) => isAccountCompatibleWithLine(account, line));

    const handleAddMapping = (lineKey: string) => {
        const line = configLines.find((configLine) => configLine.key === lineKey);
        if (!line) return;

        const lineEligibleAccounts = getEligibleAccountsForLine(line);
        if (lineEligibleAccounts.length === 0) {
            toast.error('Nenhuma conta-tÃ­tulo elegÃ­vel para esta linha');
            return;
        }

        setDraftMappings((prev) => [
            ...prev,
            {
                localId: makeLocalId(),
                line_key: lineKey,
                chart_account_id: lineEligibleAccounts[0].id,
                multiplier: 1,
                include_children: true,
            },
        ]);
    };

    const updateMapping = (localId: string, patch: Partial<DraftMapping>) => {
        setDraftMappings((prev) =>
            prev.map((mapping) =>
                mapping.localId === localId ? { ...mapping, ...patch } : mapping
            )
        );
    };

    const removeMapping = (localId: string) => {
        setDraftMappings((prev) => prev.filter((mapping) => mapping.localId !== localId));
    };

    const toggleSection = (sectionKey: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [sectionKey]: !(prev[sectionKey] ?? true),
        }));
    };

    let activeSectionKey: string | null = null;
    let activeSectionExpanded = true;

    const handleSaveConfig = async () => {
        if (!clientId) return;

        try {
            setSavingConfig(true);
            const payload = {
                mappings: draftMappings
                    .filter((mapping) => mapping.chart_account_id)
                    .map((mapping) => ({
                        line_key: mapping.line_key,
                        chart_account_id: mapping.chart_account_id,
                        multiplier: Number.isFinite(mapping.multiplier) ? mapping.multiplier : 1,
                        include_children: mapping.include_children,
                    })),
            };

            const data = await dfcService.saveConfig(clientId, payload);
            setConfig(data);
            toast.success('Configuração DFC salva');
            const freshReport = await dfcService.getReport(clientId, selectedYear);
            setReport(freshReport);
            setMode('view');
        } catch (error: any) {
            console.error('Erro ao salvar configuração DFC:', error);
            const msg = error?.response?.data?.message || 'Erro ao salvar configuração DFC';
            toast.error(msg);
        } finally {
            setSavingConfig(false);
        }
    };

    const renderCell = (value: number | null | undefined, displayType: DFCDisplayType, monthIdx: number) => {
        const baseClass = displayType === 'result'
            ? 'p-4 px-3 text-sm text-right font-mono font-black text-cyan-400'
            : 'p-3 px-3 text-sm text-right font-mono text-white/75';

        return (
            <td
                key={monthIdx}
                className={`${baseClass} ${monthIdx === selectedMonthIndex ? 'bg-cyan-500/10' : ''}`}
            >
                {value === null || value === undefined ? '—' : `${value < 0 ? '- ' : ''}${formatLocaleNumber(value)}`}
            </td>
        );
    };

    return (
        <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-white/5 flex flex-wrap justify-between items-center gap-4 bg-white/5">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Demonstração do Fluxo de Caixa</h3>
                        {report?.partial && (
                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-[10px] font-black uppercase tracking-[0.2em]">
                                Parcial
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-white/40">Método Indireto • {selectedYear}</p>
                </div>
                <div className="flex items-center gap-3">
                    {isAccountingView && (
                        <div className="flex p-1 bg-black/30 border border-white/5 rounded-2xl">
                            <button
                                onClick={() => setMode('view')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'view' ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                                Visualização
                            </button>
                            <button
                                onClick={() => setMode('config')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${mode === 'config' ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                                <Settings2 className="w-4 h-4" />
                                Configuração
                            </button>
                        </div>
                    )}
                    {mode === 'view' && (
                        <button
                            onClick={onExport}
                            className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 hover:text-white"
                            title="Exportar PDF"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                    {mode === 'config' && isAccountingView && (
                        <button
                            onClick={handleSaveConfig}
                            disabled={savingConfig || !clientId}
                            className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition-all font-bold shadow-lg shadow-cyan-500/20"
                        >
                            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar
                        </button>
                    )}
                </div>
            </div>

            {report?.warnings?.length ? (
                <div className="p-6 border-b border-white/5 space-y-3">
                    {report.warnings.map((warning, index) => (
                        <div
                            key={`${warning.code}-${warning.monthIndex ?? 'x'}-${index}`}
                            className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100"
                        >
                            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-300" />
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80 mb-1">
                                    {warning.code.replace(/_/g, ' ')}
                                </p>
                                <p className="text-sm text-amber-50/90">{warning.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {mode === 'view' ? (
                loadingReport ? (
                    <div className="p-12 flex items-center justify-center text-white/40 gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Carregando DFC...
                    </div>
                ) : (
                    <div ref={reportRef} className="bg-[#0d1829]/90 rounded-b-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5">
                                        <th className="p-4 px-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[360px] sticky left-0 z-20 bg-[#0a1628]">
                                            Linha
                                        </th>
                                        {months.map((month, monthIdx) => (
                                            <th
                                                key={month}
                                                className={`p-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-right min-w-[100px] ${monthIdx === selectedMonthIndex ? 'bg-cyan-500/10 text-cyan-400' : 'text-white/40'}`}
                                            >
                                                {month}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(report?.rows || []).map((row, index) => {
                                        if (row.type === 'separator') {
                                            if (activeSectionKey && !activeSectionExpanded) {
                                                return null;
                                            }
                                            return (
                                                <tr key={`separator-${index}`}>
                                                    <td colSpan={13} className="h-4 bg-transparent" />
                                                </tr>
                                            );
                                        }

                                        if (row.type === 'section') {
                                            const sectionKey = row.key || row.label || `section-${index}`;
                                            activeSectionKey = sectionKey;
                                            activeSectionExpanded = expandedSections[sectionKey] ?? true;
                                            return (
                                                <tr
                                                    key={`section-${index}`}
                                                    className="border-t-2 border-white/10 hover:bg-white/5 transition-colors"
                                                >
                                                    <td className="p-4 px-6 text-[11px] font-black text-white/60 uppercase tracking-[0.15em] sticky left-0 z-10 bg-[#0d1829]">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSection(sectionKey)}
                                                            className="flex w-full items-center gap-2 text-left"
                                                            aria-expanded={activeSectionExpanded}
                                                            title={activeSectionExpanded ? 'Recolher seção' : 'Abrir seção'}
                                                        >
                                                            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${activeSectionExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                            <span>{row.label}</span>
                                                        </button>
                                                    </td>
                                                    {months.map((_, monthIdx) => (
                                                        <td
                                                            key={monthIdx}
                                                            className={`p-4 px-3 text-xs text-right font-mono text-white/20 ${monthIdx === selectedMonthIndex ? 'bg-cyan-500/5' : 'bg-[#0d1829]'}`}
                                                        >
                                                            —
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        }

                                        if (activeSectionKey && !activeSectionExpanded) {
                                            return null;
                                        }

                                        const displayType = row.displayType || 'item';
                                        return (
                                            <tr
                                                key={row.key || `line-${index}`}
                                                className={displayType === 'result'
                                                    ? 'bg-cyan-500/10 border-t border-white/10'
                                                    : 'border-t border-white/5 hover:bg-white/[0.02] transition-colors'}
                                            >
                                                <td className={`sticky left-0 z-10 ${displayType === 'result' ? 'p-4 px-6 text-sm font-black text-white uppercase tracking-wide bg-[#0a1e2e]' : 'p-3 px-8 text-sm text-white/55 bg-[#0a1628]'}`}>
                                                    {row.label}
                                                </td>
                                                {(row.values || []).map((value, monthIdx) =>
                                                    renderCell(value, displayType, monthIdx)
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : (
                <div className="p-6 md:p-8 space-y-8">
                    {loadingConfig ? (
                        <div className="flex items-center justify-center text-white/40 gap-3 py-10">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Carregando configuração DFC...
                        </div>
                    ) : (
                        <>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70 mb-2">
                                    Parametrização por contas-título
                                </p>
                                <p className="text-sm text-white/55">
                                    Selecione as contas-título que alimentam cada linha. A DFC soma automaticamente a conta escolhida e, se marcado, todas as suas filhas analíticas.
                                </p>
                            </div>
                            {Object.entries(groupedConfigLines).map(([section, lines]) => (
                                <div key={section} className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white/45">
                                            {SECTION_LABELS[section] || section}
                                        </h4>
                                    </div>
                                    <div className="space-y-4">
                                        {lines.map((line) => (
                                            <div key={line.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                                    <div>
                                                        <p className="text-white font-bold">{line.label}</p>
                                                        <p className="text-xs text-white/40 uppercase tracking-[0.15em] mt-1">
                                                            {line.sourceType || 'derived'}
                                                        </p>
                                                        {line.description ? (
                                                            <p className="text-sm text-white/45 mt-2">{line.description}</p>
                                                        ) : null}
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddMapping(line.key)}
                                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-xs font-bold uppercase tracking-[0.15em]"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Adicionar conta
                                                    </button>
                                                </div>
                                                <div className="space-y-3">
                                                    {(mappingsByLine[line.key] || []).length === 0 ? (
                                                        <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-5">
                                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                                <div className="text-sm text-white/35">
                                                                    Nenhuma conta configurada nesta linha.
                                                                </div>
                                                                <button
                                                                    onClick={() => handleAddMapping(line.key)}
                                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-xs font-bold uppercase tracking-[0.15em]"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                    Adicionar conta
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        (mappingsByLine[line.key] || []).map((mapping) => {
                                                            const lineEligibleAccounts = getEligibleAccountsForLine(line);
                                                            const selectedAccount = accountsById.get(mapping.chart_account_id);
                                                            const selectAccounts = selectedAccount && !lineEligibleAccounts.some((account) => account.id === selectedAccount.id)
                                                                ? [selectedAccount, ...lineEligibleAccounts]
                                                                : lineEligibleAccounts;
                                                            return (
                                                                <div key={mapping.localId} className="rounded-xl border border-white/10 bg-[#09121f] p-4 grid grid-cols-1 lg:grid-cols-[1.6fr_0.6fr_0.8fr_auto] gap-3 items-end">
                                                                    <div className="space-y-2">
                                                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
                                                                            Conta-título
                                                                        </label>
                                                                        <SearchableAccountSelect
                                                                            options={selectAccounts.map((account): AccountOption => ({
                                                                                id: account.id,
                                                                                code: account.code,
                                                                                name: account.name,
                                                                                reducedCode: account.reduced_code,
                                                                                accountType: account.is_analytic === true ? 'A' : 'T',
                                                                            }))}
                                                                            value={mapping.chart_account_id}
                                                                            onChange={(id) => updateMapping(mapping.localId, { chart_account_id: id })}
                                                                            placeholder="Buscar conta-título..."
                                                                        />
                                                                        {selectedAccount ? (
                                                                            <div className="text-xs text-white/45 font-mono">
                                                                                Código: {selectedAccount.code} {selectedAccount.reduced_code ? `• Reduzido: ${selectedAccount.reduced_code}` : ''}
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
                                                                            Multiplicador
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={mapping.multiplier}
                                                                            onChange={(event) => updateMapping(mapping.localId, { multiplier: parseFloat(event.target.value) || 0 })}
                                                                            className="w-full rounded-xl bg-[#0d1829] border border-white/10 text-white text-sm px-4 py-3 outline-none"
                                                                        />
                                                                    </div>
                                                                    <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1829] px-4 py-3 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={mapping.include_children}
                                                                            onChange={(event) => updateMapping(mapping.localId, { include_children: event.target.checked })}
                                                                            className="rounded border-white/20 bg-transparent"
                                                                        />
                                                                        <span className="text-sm text-white/65">Incluir filhas</span>
                                                                    </label>
                                                                    <button
                                                                        onClick={() => removeMapping(mapping.localId)}
                                                                        className="inline-flex items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 p-3"
                                                                        title="Remover mapeamento"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientDfcSection;

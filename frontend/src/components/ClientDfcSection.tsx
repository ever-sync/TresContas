import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ChevronDown,
    Download,
    FileSpreadsheet,
    Loader2,
    Plus,
    Save,
    Settings2,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SearchableAccountSelect, type AccountOption } from './SearchableAccountSelect';
import { clientDocumentService } from '../services/clientDocumentService';
import {
    clientPortalDfcService,
    dfcService,
} from '../services/dfcService';
import type {
    DFCEligibleAccount,
    DFCConfigLine,
    DFCDisplayType,
} from '../services/dfcService';
import type { ClientDocument } from '../services/clientDocumentService';

const formatLocaleNumber = (number: number) =>
    Math.abs(number).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

const formatFileSize = (sizeBytes: number) => {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DFC_BALANCETE_DOCUMENT_TYPE = 'dfc_balancete';

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
    initialMode?: 'view' | 'config';
}

type DfcBalanceteDocument = ClientDocument & {
    client?: {
        id: string;
        name: string;
        cnpj: string;
    };
};

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
    initialMode = 'view',
}: ClientDfcSectionProps) => {
    const [mode, setMode] = useState<'view' | 'config'>(initialMode);
    const [draftMappings, setDraftMappings] = useState<DraftMapping[]>([]);
    const [savingConfig, setSavingConfig] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [balanceteFile, setBalanceteFile] = useState<File | null>(null);
    const [balanceteMonth, setBalanceteMonth] = useState(selectedMonthIndex + 1);
    const [balanceteYear, setBalanceteYear] = useState(selectedYear);
    const [selectedBalancete, setSelectedBalancete] = useState<DfcBalanceteDocument | null>(null);

    const queryClient = useQueryClient();

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    useEffect(() => {
        setBalanceteMonth(selectedMonthIndex + 1);
    }, [selectedMonthIndex]);

    useEffect(() => {
        setBalanceteYear(selectedYear);
    }, [selectedYear]);

    const reportQuery = useQuery({
        queryKey: ['client-dashboard-dfc-report', clientId ?? 'self', selectedYear, isAccountingView ? 'accounting' : 'client'],
        queryFn: async () => {
            if (isAccountingView && clientId) {
                return dfcService.getReport(clientId, selectedYear);
            }

            return clientPortalDfcService.getReport(selectedYear);
        },
        enabled: (isAccountingView && Boolean(clientId)) || !isAccountingView,
        staleTime: 30_000,
    });

    const configQuery = useQuery({
        queryKey: ['client-dashboard-dfc-config', clientId ?? 'self'],
        queryFn: async () => {
            if (!isAccountingView || !clientId) {
                throw new Error('Configuracao DFC indisponivel');
            }

            return dfcService.getConfig(clientId);
        },
        enabled: isAccountingView && Boolean(clientId),
        staleTime: 30_000,
    });

    const report = reportQuery.data ?? null;
    const config = configQuery.data ?? null;
    const loadingReport = reportQuery.isPending;
    const loadingConfig = configQuery.isPending;

    useEffect(() => {
        if (!reportQuery.isError) return;

        const message = reportQuery.error instanceof Error
            ? reportQuery.error.message
            : 'Erro ao carregar DFC';
        toast.error(message);
    }, [reportQuery.error, reportQuery.isError]);

    useEffect(() => {
        if (!configQuery.isError) return;

        const message = configQuery.error instanceof Error
            ? configQuery.error.message
            : 'Erro ao carregar configuracao DFC';
        toast.error(message);
    }, [configQuery.error, configQuery.isError]);

    const balanceteDocumentsQuery = useQuery({
        queryKey: ['client-dfc-balancetes', clientId ?? 'self', isAccountingView ? 'accounting' : 'client'],
        queryFn: async (): Promise<DfcBalanceteDocument[]> => {
            if (isAccountingView) {
                const documents = await clientDocumentService.listForStaff();
                return documents
                    .filter((document) => document.document_type === DFC_BALANCETE_DOCUMENT_TYPE)
                    .filter((document) => !clientId || document.client.id === clientId);
            }

            const documents = await clientDocumentService.listForClient();
            return documents.filter((document) => document.document_type === DFC_BALANCETE_DOCUMENT_TYPE);
        },
        staleTime: 30_000,
    });

    const uploadBalanceteMutation = useMutation({
        mutationFn: (payload: Parameters<typeof clientDocumentService.uploadForStaff>[0]) =>
            clientDocumentService.uploadForStaff(payload),
    });

    const balanceteDocuments = useMemo(() => {
        const documents = balanceteDocumentsQuery.data ?? [];
        return [...documents]
            .filter((document) => document.document_type === DFC_BALANCETE_DOCUMENT_TYPE)
            .sort((a, b) => {
                const yearA = a.period_year ?? 0;
                const yearB = b.period_year ?? 0;
                if (yearA !== yearB) return yearB - yearA;
                const monthA = a.period_month ?? 0;
                const monthB = b.period_month ?? 0;
                if (monthA !== monthB) return monthB - monthA;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
    }, [balanceteDocumentsQuery.data]);
    const loadingBalancetes = balanceteDocumentsQuery.isPending;
    const isUploadingBalancete = uploadBalanceteMutation.isPending;

    useEffect(() => {
        if (!balanceteDocumentsQuery.isError) return;

        const message = balanceteDocumentsQuery.error instanceof Error
            ? balanceteDocumentsQuery.error.message
            : 'Erro ao carregar balancetes';
        toast.error(message);
    }, [balanceteDocumentsQuery.error, balanceteDocumentsQuery.isError]);

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
            toast.error('Nenhuma conta-título elegível para esta linha');
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

    const handleBalanceteUpload = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!balanceteFile) {
            toast.error('Selecione a planilha do balancete');
            return;
        }

        if (!clientId && isAccountingView) {
            toast.error('Selecione um cliente antes de enviar o balancete');
            return;
        }

        try {
            await uploadBalanceteMutation.mutateAsync({
                file: balanceteFile,
                display_name: `Balancete ${months[balanceteMonth - 1]} ${balanceteYear}`,
                category: 'Balancete DFC',
                document_type: DFC_BALANCETE_DOCUMENT_TYPE,
                period_month: balanceteMonth,
                period_year: balanceteYear,
                client_id: isAccountingView ? clientId : undefined,
            });

            toast.success('Balancete enviado');
            setBalanceteFile(null);
            await balanceteDocumentsQuery.refetch();
        } catch (error: unknown) {
            console.error('Erro ao enviar balancete:', error);
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao enviar balancete'
                : 'Erro ao enviar balancete';
            toast.error(message);
        }
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

            await dfcService.saveConfig(clientId, payload);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['client-dashboard-dfc-config', clientId ?? 'self'] }),
                queryClient.invalidateQueries({ queryKey: ['client-dashboard-dfc-report', clientId ?? 'self'] }),
            ]);
            toast.success('Configuracao DFC salva');
            setMode('view');
        } catch (error: unknown) {
            console.error('Erro ao salvar configuração DFC:', error);
            const msg = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao salvar configuração DFC'
                : 'Erro ao salvar configuração DFC';
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

            <div className="p-6 border-b border-white/5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70 mb-2">
                            Balancetes mensais
                        </p>
                        <h4 className="text-lg font-bold text-white">Arquivo por mês e ano</h4>
                        <p className="text-sm text-white/40 mt-1 max-w-2xl">
                            Cada envio vira um card. O histórico não sobrescreve o mês anterior.
                        </p>
                    </div>
                    {isAccountingView && (
                        <form onSubmit={handleBalanceteUpload} className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.7fr_auto] items-end w-full md:w-auto">
                            <div className="space-y-2 md:min-w-[240px]">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Planilha</label>
                                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 cursor-pointer hover:bg-white/10 transition-all text-white/80">
                                    <span className="truncate text-sm">{balanceteFile ? balanceteFile.name : 'Selecionar planilha'}</span>
                                    <Upload className="w-4 h-4 shrink-0" />
                                    <input
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        className="hidden"
                                        onChange={(event) => setBalanceteFile(event.target.files?.[0] || null)}
                                    />
                                </label>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Mês</label>
                                <select
                                    value={balanceteMonth}
                                    onChange={(event) => setBalanceteMonth(parseInt(event.target.value, 10))}
                                    className="w-full rounded-2xl bg-[#0d1829] border border-white/10 text-white px-4 py-3 outline-none"
                                >
                                    {months.map((month, index) => (
                                        <option key={month} value={index + 1} className="bg-[#0d1829]">
                                            {month}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Ano</label>
                                <input
                                    type="number"
                                    value={balanceteYear}
                                    onChange={(event) => setBalanceteYear(parseInt(event.target.value, 10) || selectedYear)}
                                    className="w-full rounded-2xl bg-[#0d1829] border border-white/10 text-white px-4 py-3 outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isUploadingBalancete || !balanceteFile}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50"
                            >
                                {isUploadingBalancete ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                Enviar
                            </button>
                        </form>
                    )}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2">
                    {loadingBalancetes ? (
                        <div className="flex items-center gap-3 text-white/40 py-4">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Carregando balancetes...
                        </div>
                    ) : balanceteDocuments.length === 0 ? (
                        <div className="min-w-full rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-white/30">
                            Nenhum balancete enviado ainda.
                        </div>
                    ) : (
                        balanceteDocuments.map((document) => {
                            const monthLabel = document.period_month ? months[document.period_month - 1] : 'Mês';
                            const periodLabel = document.period_year ? `${monthLabel}/${document.period_year}` : monthLabel;
                            return (
                                <button
                                    key={document.id}
                                    type="button"
                                    onClick={() => setSelectedBalancete(document)}
                                    className="min-w-[240px] max-w-[240px] rounded-2xl border border-white/10 bg-[#0d1829]/90 p-4 text-left transition-all hover:border-cyan-500/30 hover:bg-white/5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70">Balancete</p>
                                            <h5 className="mt-2 truncate text-lg font-bold text-white">{periodLabel}</h5>
                                            <p className="mt-1 truncate text-xs text-white/35">{document.display_name}</p>
                                        </div>
                                        <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300">
                                            <FileSpreadsheet className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between text-xs text-white/30">
                                        <span>{formatFileSize(document.size_bytes)}</span>
                                        <span>{new Date(document.created_at).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

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

            {selectedBalancete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1628]/80 p-4 backdrop-blur-md">
                    <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1829]/95 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-white/5 p-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70">Balancete mensal</p>
                                <h4 className="mt-2 text-2xl font-bold text-white">
                                    {selectedBalancete.period_month
                                        ? `${months[selectedBalancete.period_month - 1]}/${selectedBalancete.period_year ?? ''}`
                                        : selectedBalancete.display_name}
                                </h4>
                                <p className="mt-1 text-sm text-white/35">{selectedBalancete.display_name}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedBalancete(null)}
                                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/50 transition-all hover:bg-white/10 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="grid gap-4 p-6 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Arquivo</p>
                                <p className="mt-2 text-sm text-white">{selectedBalancete.original_name}</p>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Tamanho</p>
                                <p className="mt-2 text-sm text-white">{formatFileSize(selectedBalancete.size_bytes)}</p>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Categoria</p>
                                <p className="mt-2 text-sm text-white">{selectedBalancete.category}</p>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Enviado em</p>
                                <p className="mt-2 text-sm text-white">{new Date(selectedBalancete.created_at).toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 border-t border-white/5 p-6">
                            <button
                                type="button"
                                onClick={() => setSelectedBalancete(null)}
                                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white/60 transition-all hover:bg-white/5 hover:text-white"
                            >
                                Fechar
                            </button>
                            <button
                                type="button"
                                onClick={() => isAccountingView
                                    ? clientDocumentService.downloadForStaff(selectedBalancete.id, selectedBalancete.original_name)
                                    : clientDocumentService.downloadForClient(selectedBalancete.id, selectedBalancete.original_name)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:opacity-90"
                            >
                                <Download className="w-4 h-4" />
                                Baixar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDfcSection;



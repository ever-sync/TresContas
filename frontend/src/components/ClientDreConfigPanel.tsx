import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { SearchableAccountSelect, type AccountOption } from './SearchableAccountSelect';
import api from '../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────
interface DREMappingRecord {
    id: string;
    account_code: string;
    account_name: string;
    category: string;
}

interface DraftMapping {
    localId: string;
    account_code: string;
    account_name: string;
    category: string;
}

interface DreAccount {
    id: string;
    code: string;
    name: string;
    level: number;
    type: string;
    is_analytic?: boolean | null;
    reduced_code?: string | null;
}

interface Props {
    clientId: string;
    selectedYear: number;
    onSaved?: () => void | Promise<void>;
}

// ─── DRE Categories (same order as DRE report) ─────────────────────────────
const DRE_SECTIONS: { section: string; categories: { key: string; label: string }[] }[] = [
    {
        section: 'Receitas',
        categories: [
            { key: 'receita bruta', label: 'Receita Bruta' },
            { key: 'receitas financeiras', label: 'Receitas Financeiras' },
            { key: 'outras receitas', label: 'Outras Receitas' },
        ],
    },
    {
        section: 'Deduções',
        categories: [
            { key: 'deducoes de vendas', label: 'Deduções de Vendas' },
        ],
    },
    {
        section: 'Custos',
        categories: [
            { key: 'custos das vendas', label: 'Custos das Vendas' },
            { key: 'custos dos servicos', label: 'Custos dos Serviços' },
        ],
    },
    {
        section: 'Despesas',
        categories: [
            { key: 'despesas administrativas', label: 'Despesas Administrativas' },
            { key: 'despesas comerciais', label: 'Despesas Comerciais' },
            { key: 'despesas tributarias', label: 'Despesas Tributárias' },
            { key: 'despesas financeiras', label: 'Despesas Financeiras' },
        ],
    },
    {
        section: 'Outros',
        categories: [
            { key: 'outras despesas', label: 'Outras Despesas' },
            { key: 'depreciacao e amortizacao', label: 'Depreciação e Amortização' },
            { key: 'resultado participacoes societarias', label: 'Resultado Participações Societárias' },
            { key: 'irpj e csll', label: 'IRPJ e CSLL' },
        ],
    },
];

const ALL_CATEGORY_KEYS = DRE_SECTIONS.flatMap((s) => s.categories.map((c) => c.key));

const makeLocalId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const stripAccents = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Converte key para o formato esperado pelo backend (Title Case, sem acentos)
// Ex: 'deducoes de vendas' → 'Deducoes De Vendas'
const toBackendCategory = (key: string) =>
    key.replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Component ──────────────────────────────────────────────────────────────
export const ClientDreConfigPanel: React.FC<Props> = ({ clientId, selectedYear, onSaved }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dreAccounts, setDreAccounts] = useState<DreAccount[]>([]);
    const [draftMappings, setDraftMappings] = useState<DraftMapping[]>([]);
    const [originalMappingCodes, setOriginalMappingCodes] = useState<Set<string>>(new Set());

    // Fetch existing mappings + DRE movements
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [mappingsRes, chartRes] = await Promise.all([
                    api.get(`/clients/${clientId}/dre-mappings`),
                    api.get(`/clients/${clientId}/chart-of-accounts`),
                ]);

                const mappings: DREMappingRecord[] = mappingsRes.data;
                const chart = chartRes.data as DreAccount[];

                // DRE accounts (03.x, 04.x) — all accounts including T and A
                const dreOnly = chart.filter(
                    (m) => m.code.startsWith('03') || m.code.startsWith('04')
                );
                setDreAccounts(dreOnly);

                // Build draft from existing mappings
                const drafts: DraftMapping[] = mappings.map((m) => ({
                    localId: makeLocalId(),
                    account_code: m.account_code,
                    account_name: m.account_name,
                    category: stripAccents(m.category),
                }));
                setDraftMappings(drafts);
                setOriginalMappingCodes(new Set(mappings.map((m) => m.account_code)));
            } catch (error) {
                console.error('Erro ao carregar config DRE:', error);
                toast.error('Erro ao carregar configuração DRE');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [clientId, selectedYear]);

    // Accounts mapped per category
    const mappingsByCategory = useMemo(() => {
        const map: Record<string, DraftMapping[]> = {};
        for (const cat of ALL_CATEGORY_KEYS) map[cat] = [];
        for (const m of draftMappings) {
            const key = stripAccents(m.category);
            if (map[key]) map[key].push(m);
        }
        return map;
    }, [draftMappings]);

    // Set of already-mapped account codes
    const mappedCodes = useMemo(
        () => new Set(draftMappings.map((m) => m.account_code)),
        [draftMappings]
    );

    // Unmapped accounts
    const unmappedAccounts = useMemo(
        () => dreAccounts.filter((a) => !mappedCodes.has(a.code)),
        [dreAccounts, mappedCodes]
    );

    const handleAddMapping = (categoryKey: string) => {
        if (unmappedAccounts.length === 0) {
            toast.error('Todas as contas DRE já estão mapeadas');
            return;
        }
        setDraftMappings((prev) => [
            ...prev,
            {
                localId: makeLocalId(),
                account_code: unmappedAccounts[0].code,
                account_name: unmappedAccounts[0].name,
                category: categoryKey,
            },
        ]);
    };

    const updateMappingAccount = (localId: string, accountCode: string) => {
        const account = dreAccounts.find((a) => a.code === accountCode);
        if (!account) return;
        setDraftMappings((prev) =>
            prev.map((m) =>
                m.localId === localId
                    ? { ...m, account_code: account.code, account_name: account.name }
                    : m
            )
        );
    };

    const removeMapping = (localId: string) => {
        setDraftMappings((prev) => prev.filter((m) => m.localId !== localId));
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Delete mappings that were removed
            const currentCodes = new Set(draftMappings.map((m) => m.account_code));
            const removedCodes = [...originalMappingCodes].filter((code) => !currentCodes.has(code));
            for (const code of removedCodes) {
                await api.delete(`/clients/${clientId}/dre-mappings/${encodeURIComponent(code)}`);
            }

            // Upsert all current mappings
            if (draftMappings.length > 0) {
                await api.post(`/clients/${clientId}/bulk-dre-mappings`, {
                    mappings: draftMappings.map((m) => ({
                        account_code: m.account_code,
                        account_name: m.account_name,
                        category: toBackendCategory(m.category),
                    })),
                });
            }

            setOriginalMappingCodes(new Set(draftMappings.map((m) => m.account_code)));
            await onSaved?.();
            toast.success('Configuração DRE salva!');
        } catch (error: unknown) {
            console.error('Erro ao salvar config DRE:', error);
            if (axios.isAxiosError(error)) {
                console.error('Response data:', JSON.stringify(error.response?.data));
                console.error('Response status:', error.response?.status);
            }
            const detail = axios.isAxiosError(error) ? error.response?.data?.detail || '' : '';
            const msg = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao salvar configuração DRE'
                : 'Erro ao salvar configuração DRE';
            toast.error(detail ? `${msg}: ${detail}` : msg);
        } finally {
            setSaving(false);
        }
    };

    // Auto-classify all unmapped accounts by code prefix
    const handleAutoClassify = () => {
        const inferCategory = (code: string): string | null => {
            if (code.startsWith('03.1.01')) return 'receita bruta';
            if (code.startsWith('03.1.02')) return 'deducoes de vendas';
            if (code.startsWith('03.1.03')) return 'receitas financeiras';
            if (code.startsWith('03.1.05')) return 'outras receitas';
            if (code.startsWith('03.2'))    return 'outras receitas';
            if (code.startsWith('04.1'))    return 'custos das vendas';
            if (code.startsWith('04.2.01')) return 'despesas comerciais';
            if (code.startsWith('04.2.02')) return 'despesas administrativas';
            if (code.startsWith('04.2.03')) return 'despesas financeiras';
            if (code.startsWith('04.2.05')) return 'despesas tributarias';
            if (code.startsWith('04.2'))    return 'outras despesas';
            if (code.startsWith('04.3'))    return 'irpj e csll';
            return null;
        };

        const newMappings: DraftMapping[] = [];
        for (const account of unmappedAccounts) {
            const cat = inferCategory(account.code);
            if (cat) {
                newMappings.push({
                    localId: makeLocalId(),
                    account_code: account.code,
                    account_name: account.name,
                    category: cat,
                });
            }
        }

        if (newMappings.length === 0) {
            toast('Nenhuma conta pôde ser classificada automaticamente', { icon: 'ℹ️' });
            return;
        }

        setDraftMappings((prev) => [...prev, ...newMappings]);
        toast.success(`${newMappings.length} contas classificadas automaticamente!`);
    };

    if (loading) {
        return (
            <div className="p-12 flex items-center justify-center text-white/40 gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                Carregando configuração DRE...
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70 mb-2">
                        Parametrização DE-PARA por categoria
                    </p>
                    <p className="text-sm text-white/55">
                        Associe cada conta DRE à sua categoria no relatório gerencial.
                        {unmappedAccounts.length > 0 && (
                            <span className="text-amber-300 ml-2">
                                {unmappedAccounts.length} conta(s) sem classificação.
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {unmappedAccounts.length > 0 && (
                        <button
                            onClick={handleAutoClassify}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs font-bold uppercase tracking-[0.15em]"
                        >
                            Auto-classificar ({unmappedAccounts.length})
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition-all font-bold shadow-lg shadow-cyan-500/20"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </button>
                </div>
            </div>

            {/* Sections */}
            {DRE_SECTIONS.map(({ section, categories }) => (
                <div key={section} className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white/45">
                        {section}
                    </h4>
                    <div className="space-y-4">
                        {categories.map(({ key, label }) => {
                            const lineMappings = mappingsByCategory[key] || [];
                            return (
                                <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                        <div>
                                            <p className="text-white font-bold">{label}</p>
                                            <p className="text-xs text-white/40 mt-1">
                                                {lineMappings.length} conta(s) mapeada(s)
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleAddMapping(key)}
                                            disabled={unmappedAccounts.length === 0}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-xs font-bold uppercase tracking-[0.15em] disabled:opacity-30"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Adicionar conta
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {lineMappings.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-5">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="text-sm text-white/35">
                                                        Nenhuma conta configurada nesta categoria.
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddMapping(key)}
                                                        disabled={unmappedAccounts.length === 0}
                                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-xs font-bold uppercase tracking-[0.15em] disabled:opacity-30"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Adicionar conta
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            lineMappings.map((mapping) => {
                                                // Show: all DRE accounts (for search)
                                                const allOptions: AccountOption[] = dreAccounts.map((a) => ({
                                                    id: a.code,
                                                    code: a.code,
                                                    name: a.name,
                                                    accountType: a.is_analytic === true ? 'A' : 'T',
                                                }));

                                                return (
                                                    <div
                                                        key={mapping.localId}
                                                        className="rounded-xl border border-white/10 bg-[#09121f] p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end"
                                                    >
                                                        <div className="space-y-2">
                                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
                                                                Conta
                                                            </label>
                                                            <SearchableAccountSelect
                                                                options={allOptions}
                                                                value={mapping.account_code}
                                                                onChange={(code) => updateMappingAccount(mapping.localId, code)}
                                                                placeholder="Buscar conta DRE..."
                                                            />
                                                        </div>
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
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Unmapped summary */}
            {unmappedAccounts.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80 mb-2">
                        Contas não mapeadas ({unmappedAccounts.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 mt-3">
                        {unmappedAccounts.slice(0, 20).map((a) => (
                            <p key={a.code} className="text-xs text-amber-100/70 font-mono">
                                {a.code} • {a.name}
                            </p>
                        ))}
                        {unmappedAccounts.length > 20 && (
                            <p className="text-xs text-amber-100/50">
                                ... e mais {unmappedAccounts.length - 20} contas
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDreConfigPanel;


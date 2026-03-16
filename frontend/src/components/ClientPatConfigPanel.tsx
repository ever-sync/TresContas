import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────
interface MappingRecord {
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

interface PatAccount {
    code: string;
    name: string;
    level: number;
}

interface Props {
    clientId: string;
    selectedYear: number;
}

// ─── Patrimonial Sections & Categories (mirrors PAT_STRUCTURE) ──────────────
const PAT_SECTIONS: { section: string; categories: { key: string; label: string }[] }[] = [
    {
        section: 'Ativo Circulante',
        categories: [
            { key: 'disponivel', label: 'Disponível' },
            { key: 'clientes', label: 'Clientes' },
            { key: 'adiantamentos', label: 'Adiantamentos' },
            { key: 'estoques', label: 'Estoques' },
            { key: 'tributos a compensarcp', label: 'Tributos a Compensar CP' },
            { key: 'outras contas a receber', label: 'Outras Contas a Receber' },
            { key: 'despesas antecipadas', label: 'Despesas Antecipadas' },
        ],
    },
    {
        section: 'Ativo Não Circulante',
        categories: [
            { key: 'contas a receber lp', label: 'Contas a Receber LP' },
            { key: 'processos judiciais', label: 'Processos Judiciais' },
            { key: 'partes relacionadas a receber', label: 'Partes Relacionadas a Receber' },
            { key: 'outras contas a receber lp', label: 'Outras Contas a Receber LP' },
            { key: 'tributos a recuperarlp', label: 'Tributos a Recuperar LP' },
            { key: 'investimentos', label: 'Investimentos' },
            { key: 'imobilizado', label: 'Imobilizado' },
            { key: 'intangivel', label: 'Intangível' },
        ],
    },
    {
        section: 'Passivo Circulante',
        categories: [
            { key: 'fornecedores', label: 'Fornecedores' },
            { key: 'emprestimos e financiamentos cp', label: 'Empréstimos e Financiamentos CP' },
            { key: 'obrigacoes trabalhistas', label: 'Obrigações Trabalhistas' },
            { key: 'obrigacoes tributarias', label: 'Obrigações Tributárias' },
            { key: 'contas a pagar cp', label: 'Contas a Pagar CP' },
            { key: 'parcelamentos cp', label: 'Parcelamentos CP' },
            { key: 'processos a pagar cp', label: 'Processos a Pagar CP' },
        ],
    },
    {
        section: 'Passivo Não Circulante',
        categories: [
            { key: 'emprestimos e financiamentos lp', label: 'Empréstimos e Financiamentos LP' },
            { key: 'conta corrente dos socios', label: 'Conta Corrente dos Sócios' },
            { key: 'emprestimos partes relacionadas', label: 'Empréstimos Partes Relacionadas' },
            { key: 'parcelamentos lp', label: 'Parcelamentos LP' },
            { key: 'processos a pagar lp', label: 'Processos a Pagar LP' },
            { key: 'impostos diferidos', label: 'Impostos Diferidos' },
            { key: 'outras contas a pagar lp', label: 'Outras Contas a Pagar LP' },
            { key: 'receita de exercicio futuro lp', label: 'Receita de Exercício Futuro LP' },
            { key: 'provisao para contingencias', label: 'Provisão para Contingências' },
        ],
    },
    {
        section: 'Patrimônio Líquido',
        categories: [
            { key: 'capital social', label: 'Capital Social' },
            { key: 'reserva de capital', label: 'Reserva de Capital' },
            { key: 'reserva de lucros', label: 'Reserva de Lucros' },
            { key: 'resultado do exercicio', label: 'Resultado do Exercício' },
            { key: 'distribuicao de lucros', label: 'Distribuição de Lucros' },
        ],
    },
];

const ALL_CATEGORY_KEYS = PAT_SECTIONS.flatMap((s) => s.categories.map((c) => c.key));

const makeLocalId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const stripAccents = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Auto-classify patrimonial accounts by code prefix
const inferPatCategory = (code: string): string | null => {
    // Ativo Circulante (01.1.xx)
    if (code.startsWith('01.1.01')) return 'disponivel';
    if (code.startsWith('01.1.02')) return 'clientes';
    if (code.startsWith('01.1.03')) return 'adiantamentos';
    if (code.startsWith('01.1.04')) return 'estoques';
    if (code.startsWith('01.1.05')) return 'tributos a compensarcp';
    if (code.startsWith('01.1.06')) return 'outras contas a receber';
    if (code.startsWith('01.1.07')) return 'despesas antecipadas';
    // Ativo Não Circulante (01.2.xx)
    if (code.startsWith('01.2.01')) return 'contas a receber lp';
    if (code.startsWith('01.2.02')) return 'processos judiciais';
    if (code.startsWith('01.2.03')) return 'partes relacionadas a receber';
    if (code.startsWith('01.2.04')) return 'outras contas a receber lp';
    if (code.startsWith('01.2.05')) return 'tributos a recuperarlp';
    if (code.startsWith('01.2.06')) return 'investimentos';
    if (code.startsWith('01.2.07')) return 'imobilizado';
    if (code.startsWith('01.2.08')) return 'intangivel';
    // Passivo Circulante (02.1.xx)
    if (code.startsWith('02.1.01')) return 'fornecedores';
    if (code.startsWith('02.1.02')) return 'emprestimos e financiamentos cp';
    if (code.startsWith('02.1.03')) return 'obrigacoes trabalhistas';
    if (code.startsWith('02.1.04')) return 'obrigacoes tributarias';
    if (code.startsWith('02.1.05')) return 'contas a pagar cp';
    if (code.startsWith('02.1.06')) return 'parcelamentos cp';
    if (code.startsWith('02.1.07')) return 'processos a pagar cp';
    // Passivo Não Circulante (02.2.xx / 02.3.xx)
    if (code.startsWith('02.2.01')) return 'emprestimos e financiamentos lp';
    if (code.startsWith('02.2.02')) return 'conta corrente dos socios';
    if (code.startsWith('02.2.03')) return 'emprestimos partes relacionadas';
    if (code.startsWith('02.2.04')) return 'parcelamentos lp';
    if (code.startsWith('02.2.05')) return 'processos a pagar lp';
    if (code.startsWith('02.2.06')) return 'impostos diferidos';
    if (code.startsWith('02.2.07')) return 'outras contas a pagar lp';
    if (code.startsWith('02.2.08') || code.startsWith('02.3.01')) return 'receita de exercicio futuro lp';
    if (code.startsWith('02.2.09') || code.startsWith('02.3.02')) return 'provisao para contingencias';
    // Patrimônio Líquido (02.4.xx)
    if (code.startsWith('02.4.01')) return 'capital social';
    if (code.startsWith('02.4.02')) return 'reserva de capital';
    if (code.startsWith('02.4.03')) return 'reserva de lucros';
    if (code.startsWith('02.4.04')) return 'resultado do exercicio';
    if (code.startsWith('02.4.05')) return 'distribuicao de lucros';
    return null;
};

// ─── Component ──────────────────────────────────────────────────────────────
export const ClientPatConfigPanel: React.FC<Props> = ({ clientId, selectedYear }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [patAccounts, setPatAccounts] = useState<PatAccount[]>([]);
    const [draftMappings, setDraftMappings] = useState<DraftMapping[]>([]);
    const [originalMappingCodes, setOriginalMappingCodes] = useState<Set<string>>(new Set());

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [mappingsRes, movementsRes] = await Promise.all([
                    api.get(`/clients/${clientId}/dre-mappings`),
                    api.get(`/clients/${clientId}/movements`, { params: { year: selectedYear, type: 'patrimonial' } }),
                ]);

                const allMappings: MappingRecord[] = mappingsRes.data;
                const movements = movementsRes.data as Array<{ code: string; name: string; level: number }>;

                // Patrimonial accounts = leaf accounts (01.x, 02.x)
                const patOnly = movements.filter(
                    (m) => m.code.startsWith('01') || m.code.startsWith('02')
                );
                const leafAccounts = patOnly.filter(
                    (m) => !patOnly.some((c) => c.code !== m.code && c.code.startsWith(m.code + '.'))
                );
                setPatAccounts(leafAccounts);

                // Filter mappings that are for patrimonial categories
                const patCategoryKeys = new Set(ALL_CATEGORY_KEYS);
                const patMappings = allMappings.filter((m) =>
                    patCategoryKeys.has(stripAccents(m.category))
                );

                const drafts: DraftMapping[] = patMappings.map((m) => ({
                    localId: makeLocalId(),
                    account_code: m.account_code,
                    account_name: m.account_name,
                    category: stripAccents(m.category),
                }));
                setDraftMappings(drafts);
                setOriginalMappingCodes(new Set(patMappings.map((m) => m.account_code)));
            } catch (error) {
                console.error('Erro ao carregar config Patrimonial:', error);
                toast.error('Erro ao carregar configuração Patrimonial');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [clientId, selectedYear]);

    const mappingsByCategory = useMemo(() => {
        const map: Record<string, DraftMapping[]> = {};
        for (const cat of ALL_CATEGORY_KEYS) map[cat] = [];
        for (const m of draftMappings) {
            const key = stripAccents(m.category);
            if (map[key]) map[key].push(m);
        }
        return map;
    }, [draftMappings]);

    const mappedCodes = useMemo(
        () => new Set(draftMappings.map((m) => m.account_code)),
        [draftMappings]
    );

    const unmappedAccounts = useMemo(
        () => patAccounts.filter((a) => !mappedCodes.has(a.code)),
        [patAccounts, mappedCodes]
    );

    const handleAddMapping = (categoryKey: string) => {
        if (unmappedAccounts.length === 0) {
            toast.error('Todas as contas patrimoniais já estão mapeadas');
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
        const account = patAccounts.find((a) => a.code === accountCode);
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

    const categoryLabel = (key: string) =>
        PAT_SECTIONS.flatMap((s) => s.categories).find((c) => c.key === key)?.label || key;

    const handleSave = async () => {
        try {
            setSaving(true);

            const currentCodes = new Set(draftMappings.map((m) => m.account_code));
            const removedCodes = [...originalMappingCodes].filter((code) => !currentCodes.has(code));
            for (const code of removedCodes) {
                await api.delete(`/clients/${clientId}/dre-mappings/${encodeURIComponent(code)}`);
            }

            if (draftMappings.length > 0) {
                await api.post(`/clients/${clientId}/bulk-dre-mappings`, {
                    mappings: draftMappings.map((m) => ({
                        account_code: m.account_code,
                        account_name: m.account_name,
                        category: categoryLabel(m.category),
                    })),
                });
            }

            setOriginalMappingCodes(new Set(draftMappings.map((m) => m.account_code)));
            toast.success('Configuração Patrimonial salva!');
        } catch (error) {
            console.error('Erro ao salvar config Patrimonial:', error);
            toast.error('Erro ao salvar configuração Patrimonial');
        } finally {
            setSaving(false);
        }
    };

    const handleAutoClassify = () => {
        const newMappings: DraftMapping[] = [];
        for (const account of unmappedAccounts) {
            const cat = inferPatCategory(account.code);
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
                Carregando configuração Patrimonial...
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70 mb-2">
                        Parametrização DE-PARA por grupo patrimonial
                    </p>
                    <p className="text-sm text-white/55">
                        Associe cada conta patrimonial ao seu grupo no Balanço.
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
            {PAT_SECTIONS.map(({ section, categories }) => (
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
                                                        Nenhuma conta configurada neste grupo.
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
                                                const selectOptions = [
                                                    patAccounts.find((a) => a.code === mapping.account_code),
                                                    ...unmappedAccounts,
                                                ].filter((a): a is PatAccount => !!a);

                                                return (
                                                    <div
                                                        key={mapping.localId}
                                                        className="rounded-xl border border-white/10 bg-[#09121f] p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end"
                                                    >
                                                        <div className="space-y-2">
                                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
                                                                Conta
                                                            </label>
                                                            <select
                                                                value={mapping.account_code}
                                                                onChange={(e) =>
                                                                    updateMappingAccount(mapping.localId, e.target.value)
                                                                }
                                                                className="w-full rounded-xl bg-[#0d1829] border border-white/10 text-white text-sm px-4 py-3 outline-none"
                                                            >
                                                                {selectOptions.map((a) => (
                                                                    <option
                                                                        key={a.code}
                                                                        value={a.code}
                                                                        className="bg-[#0d1829]"
                                                                    >
                                                                        {a.code} • {a.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <div className="text-xs text-white/45 font-mono">
                                                                Código: {mapping.account_code}
                                                            </div>
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

export default ClientPatConfigPanel;

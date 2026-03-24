import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { Client } from '../services/clientService';

const ClientDreConfigPanel = lazy(() => import('./ClientDreConfigPanel'));
const ClientPatConfigPanel = lazy(() => import('./ClientPatConfigPanel'));

type ParametrizacaoSection = 'home' | 'dre' | 'patrimonial';

const SectionCard = ({
    title,
    description,
    icon: Icon,
    onClick,
}: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        className="text-left bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5 hover:border-cyan-500/30 transition-all group"
    >
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center text-cyan-400 mb-4 shadow-inner">
            <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors">{title}</h3>
        <p className="text-slate-500 text-sm mt-2">{description}</p>
        <div className="mt-4 inline-flex items-center gap-2 text-cyan-400 text-sm font-medium">
            Abrir
            <ChevronRight className="w-4 h-4" />
        </div>
    </button>
);

interface AccountingParametrizacaoPanelProps {
    clients: Client[];
}

const pickDefaultClientId = (clients: Client[]) => {
    const cocaCola = clients.find((client) => client.name.toLowerCase().includes('coca cola'));
    return cocaCola?.id || clients[0]?.id || '';
};

export const AccountingParametrizacaoPanel = ({ clients }: AccountingParametrizacaoPanelProps) => {
    const [section, setSection] = useState<ParametrizacaoSection>('home');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const recentYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    }, []);

    const effectiveClientId = selectedClientId || pickDefaultClientId(clients);
    const effectiveClient = clients.find((client) => client.id === effectiveClientId) ?? clients[0] ?? null;

    if (clients.length === 0) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                    <h2 className="text-3xl font-bold text-white">Parametrização</h2>
                    <p className="text-slate-400">Configure DRE e Patrimonial de forma global para todos os clientes.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0d1829]/80 p-8 text-slate-400">
                    Nenhum cliente disponivel para usar como base da parametrizacao.
                </div>
            </div>
        );
    }

    if (section === 'home') {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white">Parametrização</h2>
                        <p className="text-slate-400">
                            O que for salvo aqui vale para todos os clientes. DFC continua sendo configurado dentro do cliente.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white/70">
                            Cliente base
                            <select
                                className="bg-transparent outline-none cursor-pointer text-sm font-black text-cyan-300"
                                value={effectiveClientId}
                                onChange={(event) => setSelectedClientId(event.target.value)}
                            >
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id} className="bg-[#0d1829]">
                                        {client.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white/70">
                            Ano
                            <select
                                className="bg-transparent outline-none cursor-pointer text-sm font-black text-cyan-300"
                                value={selectedYear}
                                onChange={(event) => setSelectedYear(parseInt(event.target.value, 10))}
                            >
                                {recentYears.map((year) => (
                                    <option key={year} value={year} className="bg-[#0d1829]">
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                {effectiveClient && (
                    <div className="rounded-2xl border border-white/10 bg-[#0d1829]/70 p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
                            {effectiveClient.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-semibold truncate">{effectiveClient.name}</p>
                            <p className="text-slate-500 text-sm truncate">{effectiveClient.cnpj}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SectionCard
                        title="DRE"
                        description="Abra a parametrização global do DRE e copie a base do cliente selecionado."
                        icon={FileText}
                        onClick={() => setSection('dre')}
                    />
                    <SectionCard
                        title="Patrimonial"
                        description="Abra a parametrização global patrimonial e copie a base do cliente selecionado."
                        icon={Building2}
                        onClick={() => setSection('patrimonial')}
                    />
                </div>
            </div>
        );
    }

    const renderPanel = () => {
        if (!effectiveClientId || !effectiveClient) return null;

        if (section === 'dre') {
            return (
                <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#0d1829]/80 p-8 text-slate-400">Carregando parametrização DRE...</div>}>
                    <ClientDreConfigPanel
                        clientId={effectiveClientId}
                        selectedYear={selectedYear}
                        scope="global"
                        sourceClientId={effectiveClientId}
                    />
                </Suspense>
            );
        }

        return (
            <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#0d1829]/80 p-8 text-slate-400">Carregando parametrização patrimonial...</div>}>
                <ClientPatConfigPanel
                    clientId={effectiveClientId}
                    selectedYear={selectedYear}
                    scope="global"
                    sourceClientId={effectiveClientId}
                />
            </Suspense>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white">
                        {section === 'dre' ? 'Parametrização DRE Global' : 'Parametrização Patrimonial Global'}
                    </h2>
                    <p className="text-slate-400">Cliente base: {effectiveClient?.name || 'Sem cliente'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setSection('home')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Voltar
                    </button>
                </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#0d1829]/80 backdrop-blur-xl shadow-2xl overflow-hidden">
                {renderPanel()}
            </div>
        </div>
    );
};

export default AccountingParametrizacaoPanel;

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { Client } from '../services/clientService';
import api from '../services/api';
import { chartOfAccountsService } from '../services/chartOfAccountsService';

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
        className="group rounded-2xl border border-white/5 bg-[#0d1829]/80 p-6 text-left backdrop-blur-xl transition-all hover:border-cyan-500/30"
    >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 shadow-inner">
            <Icon className="h-6 w-6" />
        </div>
        <h3 className="font-semibold text-white transition-colors group-hover:text-cyan-400">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-400">
            Abrir
            <ChevronRight className="h-4 w-4" />
        </div>
    </button>
);

interface AccountingParametrizacaoPanelProps {
    clients: Client[];
}

const normalizeClientName = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const pickReferenceClient = (clients: Client[]) =>
    clients.find((client) => normalizeClientName(client.name).includes('coca cola')) || clients[0] || null;

export const AccountingParametrizacaoPanel = ({ clients }: AccountingParametrizacaoPanelProps) => {
    const [section, setSection] = useState<ParametrizacaoSection>('home');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const queryClient = useQueryClient();

    const recentYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    }, []);

    const referenceClient = useMemo(() => pickReferenceClient(clients), [clients]);

    useEffect(() => {
        if (!referenceClient) return;

        void queryClient.prefetchQuery({
            queryKey: ['staff-chart-of-accounts'],
            queryFn: () => chartOfAccountsService.getSharedAll(),
            staleTime: 300_000,
        });

        void queryClient.prefetchQuery({
            queryKey: ['global-dre-mappings'],
            queryFn: async () => {
                const response = await api.get('/accounting/dre-mappings');
                return Array.isArray(response.data) ? response.data : [];
            },
            staleTime: 300_000,
        });
    }, [queryClient, referenceClient]);

    if (clients.length === 0) {
        return (
            <div className="animate-in space-y-6 fade-in duration-300">
                <div>
                    <h2 className="text-3xl font-bold text-white">Parametrizacao</h2>
                    <p className="text-slate-400">Configure DRE e Patrimonial de forma global para todos os clientes.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0d1829]/80 p-8 text-slate-400">
                    Nenhum cliente disponivel para usar como referencia da parametrizacao.
                </div>
            </div>
        );
    }

    if (section === 'home') {
        return (
            <div className="animate-in space-y-6 fade-in duration-300">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white">Parametrizacao</h2>
                        <p className="text-slate-400">
                            O que for salvo aqui vale para todos os clientes. DFC continua sendo configurado dentro do cliente.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold text-white/70">
                            Ano
                            <select
                                className="cursor-pointer bg-transparent text-sm font-black text-cyan-300 outline-none"
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

                {referenceClient && (
                    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0d1829]/70 p-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-400 to-blue-600 font-bold text-white shadow-lg shadow-cyan-500/20">
                            {referenceClient.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-white">Base de referencia: {referenceClient.name}</p>
                            <p className="truncate text-sm text-slate-500">
                                Nao existe seletor de cliente nesta tela. A gravacao continua sendo global para toda a carteira.
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <SectionCard
                        title="DRE"
                        description="Abra a parametrizacao global do DRE usando a base de referencia da Coca-Cola."
                        icon={FileText}
                        onClick={() => setSection('dre')}
                    />
                    <SectionCard
                        title="Patrimonial"
                        description="Abra a parametrizacao global patrimonial usando a mesma base de referencia."
                        icon={Building2}
                        onClick={() => setSection('patrimonial')}
                    />
                </div>
            </div>
        );
    }

    const renderPanel = () => {
        if (!referenceClient) return null;

        if (section === 'dre') {
            return (
                <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#0d1829]/80 p-8 text-slate-400">Carregando parametrizacao DRE...</div>}>
                    <ClientDreConfigPanel
                        clientId={referenceClient.id}
                        selectedYear={selectedYear}
                        scope="global"
                        sourceClientId={referenceClient.id}
                        sourceClientName={referenceClient.name}
                    />
                </Suspense>
            );
        }

        return (
            <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#0d1829]/80 p-8 text-slate-400">Carregando parametrizacao patrimonial...</div>}>
                <ClientPatConfigPanel
                    clientId={referenceClient.id}
                    selectedYear={selectedYear}
                    scope="global"
                    sourceClientId={referenceClient.id}
                    sourceClientName={referenceClient.name}
                />
            </Suspense>
        );
    };

    return (
        <div className="animate-in space-y-6 fade-in duration-300">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white">
                        {section === 'dre' ? 'Parametrizacao DRE Global' : 'Parametrizacao Patrimonial Global'}
                    </h2>
                    <p className="text-slate-400">Base de referencia: {referenceClient?.name || 'Sem cliente'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setSection('home')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-white/10"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Voltar
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#0d1829]/80 shadow-2xl backdrop-blur-xl">
                {renderPanel()}
            </div>
        </div>
    );
};

export default AccountingParametrizacaoPanel;

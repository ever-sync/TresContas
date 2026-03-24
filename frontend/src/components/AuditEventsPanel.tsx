import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCcw, Search } from 'lucide-react';
import { auditService } from '../services/auditService';

const AuditEventsPanel = () => {
    const [action, setAction] = useState('');
    const [entityType, setEntityType] = useState('');
    const [entityId, setEntityId] = useState('');

    const filters = useMemo(() => ({
        action: action.trim() || undefined,
        entityType: entityType.trim() || undefined,
        entityId: entityId.trim() || undefined,
        limit: 50,
    }), [action, entityType, entityId]);

    const auditQuery = useQuery({
        queryKey: ['audit-events', filters],
        queryFn: () => auditService.getAll(filters),
        staleTime: 15_000,
    });

    const events = auditQuery.data ?? [];

    return (
        <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Auditoria</h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Eventos recentes de login, convite, documentos e alteracoes sensiveis.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => auditQuery.refetch()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-200 hover:bg-white/10 transition-colors"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <label className="block">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Acao</span>
                    <div className="mt-1 relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={action}
                            onChange={(event) => setAction(event.target.value)}
                            placeholder="auth.login"
                            className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                        />
                    </div>
                </label>

                <label className="block">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Entidade</span>
                    <input
                        value={entityType}
                        onChange={(event) => setEntityType(event.target.value)}
                        placeholder="user, client, document..."
                        className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    />
                </label>

                <label className="block">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">ID da entidade</span>
                    <input
                        value={entityId}
                        onChange={(event) => setEntityId(event.target.value)}
                        placeholder="opcional"
                        className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    />
                </label>
            </div>

            {auditQuery.isPending ? (
                <div className="text-slate-400 text-sm">Carregando auditoria...</div>
            ) : events.length === 0 ? (
                <div className="text-slate-400 text-sm">Nenhum evento encontrado para os filtros atuais.</div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-white/5 text-slate-400 uppercase text-[11px] tracking-[0.2em]">
                            <tr>
                                <th className="px-4 py-3">Quando</th>
                                <th className="px-4 py-3">Acao</th>
                                <th className="px-4 py-3">Entidade</th>
                                <th className="px-4 py-3">Ator</th>
                                <th className="px-4 py-3">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr key={event.id} className="border-t border-white/5">
                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                        {new Date(event.created_at).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-4 py-3 text-cyan-300 font-medium whitespace-nowrap">
                                        {event.action}
                                    </td>
                                    <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                                        {event.entity_type}
                                        {event.entity_id ? ` / ${event.entity_id}` : ''}
                                    </td>
                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                        {event.actor_role || '-'}{event.actor_id ? ` / ${event.actor_id}` : ''}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 max-w-[28rem]">
                                        <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                                            {JSON.stringify(event.metadata || {}, null, 2)}
                                        </pre>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AuditEventsPanel;

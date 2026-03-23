import type { ReactNode } from 'react';
import { Clock, Loader2, MessageSquare, Send } from 'lucide-react';
import {
    getSupportPriorityMeta,
    getSupportStatusMeta,
    type SupportPriority,
    type SupportStatus,
} from './supportTicketMeta';

export interface SupportThreadMessage {
    id: string;
    author_role: 'client' | 'staff';
    author_name: string;
    body: string;
    created_at: string;
}

export interface SupportDetailTicket {
    id: string;
    subject: string;
    message: string;
    priority: SupportPriority;
    status: SupportStatus;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
}

interface SupportTicketDetailPanelProps {
    ticket: SupportDetailTicket | null;
    messages: SupportThreadMessage[];
    isLoadingMessages: boolean;
    replyDraft: string;
    isSubmittingReply: boolean;
    onReplyDraftChange: (value: string) => void;
    onReplySubmit: () => void;
    metadata?: ReactNode;
    statusActions?: ReactNode;
    emptyTitle?: string;
    emptyDescription?: string;
    replyLabel?: string;
    disabledReply?: boolean;
}

export const SupportTicketDetailPanel = ({
    ticket,
    messages,
    isLoadingMessages,
    replyDraft,
    isSubmittingReply,
    onReplyDraftChange,
    onReplySubmit,
    metadata,
    statusActions,
    emptyTitle = 'Selecione um chamado',
    emptyDescription = 'Escolha um item da lista para acompanhar o historico e responder.',
    replyLabel = 'Responder chamado',
    disabledReply = false,
}: SupportTicketDetailPanelProps) => {
    if (!ticket) {
        return (
            <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl border border-white/5 p-10 lg:p-12 text-center min-h-[520px] flex flex-col justify-center">
                <div className="w-16 h-16 rounded-3xl bg-white/5 text-white/20 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white/70">{emptyTitle}</h3>
                <p className="text-sm text-white/30 mt-2 max-w-md mx-auto">{emptyDescription}</p>
            </div>
        );
    }

    const priority = getSupportPriorityMeta(ticket.priority);
    const status = getSupportStatusMeta(ticket.status);

    return (
        <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden min-h-[520px]">
            <div className="px-6 py-5 border-b border-white/5 bg-white/[0.03]">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white">{ticket.subject}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className={`text-xs px-2.5 py-1 rounded-md border ${priority.className}`}>
                                    {priority.label}
                                </span>
                                <span className={`text-xs px-2.5 py-1 rounded-md border ${status.className}`}>
                                    {status.label}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    Atualizado em {new Date(ticket.updated_at).toLocaleString('pt-BR')}
                                </span>
                            </div>
                        </div>
                        {statusActions}
                    </div>
                    {metadata}
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                        Abertura do chamado
                    </p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{ticket.message}</p>
                    <p className="text-xs text-slate-500 mt-3">
                        {new Date(ticket.created_at).toLocaleString('pt-BR')}
                    </p>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-white">Historico</h4>
                        <span className="text-xs text-slate-500">{messages.length} mensagem(ns)</span>
                    </div>

                    {isLoadingMessages ? (
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 flex items-center justify-center gap-3 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Carregando conversa...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
                            Ainda nao ha mensagens adicionais neste chamado.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {messages.map((message) => {
                                const isStaff = message.author_role === 'staff';

                                return (
                                    <div
                                        key={message.id}
                                        className={`rounded-2xl border p-4 ${
                                            isStaff
                                                ? 'border-cyan-500/20 bg-cyan-500/5'
                                                : 'border-white/5 bg-white/[0.03]'
                                        }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-1 rounded-md border ${
                                                    isStaff
                                                        ? 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
                                                        : 'border-white/10 text-slate-300 bg-white/[0.04]'
                                                }`}>
                                                    {isStaff ? 'Contabilidade' : 'Cliente'}
                                                </span>
                                                <span className="text-sm font-semibold text-white/85">{message.author_name}</span>
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                {new Date(message.created_at).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{message.body}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="text-sm font-semibold text-white">{replyLabel}</h4>
                        {ticket.closed_at && (
                            <span className="text-xs text-slate-500">
                                Encerrado em {new Date(ticket.closed_at).toLocaleString('pt-BR')}
                            </span>
                        )}
                    </div>
                    <textarea
                        value={replyDraft}
                        onChange={(event) => onReplyDraftChange(event.target.value)}
                        placeholder="Escreva a proxima mensagem deste chamado..."
                        disabled={disabledReply || isSubmittingReply}
                        className="w-full min-h-[140px] bg-[#08111e] border border-white/10 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500/30 resize-none disabled:opacity-60"
                    />
                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={onReplySubmit}
                            disabled={disabledReply || isSubmittingReply}
                            className="inline-flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition-all font-semibold"
                        >
                            {isSubmittingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar mensagem
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportTicketDetailPanel;

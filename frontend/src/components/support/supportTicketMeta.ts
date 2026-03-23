export type SupportPriority = 'low' | 'medium' | 'high';
export type SupportStatus = 'open' | 'in_progress' | 'closed';

const priorityMeta: Record<SupportPriority, { label: string; className: string }> = {
    high: {
        label: 'Alta',
        className: 'border-red-400/40 text-red-300 bg-red-500/10',
    },
    medium: {
        label: 'Media',
        className: 'border-amber-400/40 text-amber-300 bg-amber-500/10',
    },
    low: {
        label: 'Baixa',
        className: 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10',
    },
};

const statusMeta: Record<SupportStatus, { label: string; className: string }> = {
    open: {
        label: 'Aberto',
        className: 'border-cyan-400/40 text-cyan-300 bg-cyan-500/10',
    },
    in_progress: {
        label: 'Em atendimento',
        className: 'border-purple-400/40 text-purple-300 bg-purple-500/10',
    },
    closed: {
        label: 'Resolvido',
        className: 'border-slate-500/40 text-slate-300 bg-slate-500/10',
    },
};

export const getSupportPriorityMeta = (priority: SupportPriority) => priorityMeta[priority];
export const getSupportStatusMeta = (status: SupportStatus) => statusMeta[status];

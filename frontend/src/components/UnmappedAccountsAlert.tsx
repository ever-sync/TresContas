import React from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { DRECalculationService, MovementRow } from '../services/dreCalculationService';

interface UnmappedAccountsAlertProps {
    movements: MovementRow[];
    onMapClick?: () => void;
    isCompact?: boolean;
}

export const UnmappedAccountsAlert: React.FC<UnmappedAccountsAlertProps> = ({
    movements,
    onMapClick,
    isCompact = false,
}) => {
    const unmappedAccounts = DRECalculationService.getUnmappedAccounts(movements);
    const stats = DRECalculationService.getMappingStats(movements);

    if (unmappedAccounts.length === 0) {
        return null;
    }

    const alertColor = stats.mappingPercentage < 50 ? 'red' : 'amber';
    const alertBgColor = alertColor === 'red' ? 'bg-red-500/10' : 'bg-amber-500/10';
    const alertBorderColor = alertColor === 'red' ? 'border-red-500/20' : 'border-amber-500/20';
    const alertTextColor = alertColor === 'red' ? 'text-red-400' : 'text-amber-400';
    const alertIconColor = alertColor === 'red' ? 'text-red-500' : 'text-amber-500';

    if (isCompact) {
        return (
            <div className={`${alertBgColor} border ${alertBorderColor} rounded-lg p-3 flex items-center gap-3`}>
                <AlertCircle className={`w-5 h-5 ${alertIconColor} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${alertTextColor}`}>
                        {unmappedAccounts.length} conta(s) não mapeada(s)
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                        {stats.mappingPercentage.toFixed(1)}% das contas estão mapeadas
                    </p>
                </div>
                {onMapClick && (
                    <button
                        onClick={onMapClick}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
                            alertColor === 'red'
                                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                        }`}
                    >
                        Mapear
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`${alertBgColor} border ${alertBorderColor} rounded-2xl p-6`}>
            <div className="flex items-start gap-4">
                <AlertCircle className={`w-6 h-6 ${alertIconColor} flex-shrink-0 mt-1`} />
                <div className="flex-1">
                    <h4 className={`text-lg font-bold ${alertTextColor}`}>
                        {unmappedAccounts.length} Conta(s) Não Mapeada(s)
                    </h4>
                    <p className="text-sm text-white/60 mt-2">
                        Para gerar um DRE completo e preciso, você precisa mapear todas as contas do Plano de Contas
                        para as categorias de relatório. Atualmente, <strong>{stats.mappingPercentage.toFixed(1)}%</strong> das
                        contas estão mapeadas.
                    </p>

                    {/* Detalhes das contas não mapeadas */}
                    <details className="mt-4">
                        <summary className="cursor-pointer flex items-center gap-2 text-sm font-bold text-white/80 hover:text-white transition-colors">
                            <ChevronDown className="w-4 h-4" />
                            Ver contas não mapeadas
                        </summary>
                        <div className="mt-3 space-y-2 pl-6">
                            {unmappedAccounts.slice(0, 10).map(account => (
                                <div key={account.code} className="text-xs text-white/60">
                                    <span className="font-mono text-cyan-400">{account.code}</span>
                                    {' - '}
                                    <span>{account.name}</span>
                                </div>
                            ))}
                            {unmappedAccounts.length > 10 && (
                                <div className="text-xs text-white/40 italic">
                                    ... e mais {unmappedAccounts.length - 10} conta(s)
                                </div>
                            )}
                        </div>
                    </details>

                    {/* Barra de progresso */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white/60">Progresso de Mapeamento</span>
                            <span className={`text-xs font-bold ${alertTextColor}`}>
                                {stats.mapped}/{stats.total}
                            </span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full transition-all ${
                                    alertColor === 'red'
                                        ? 'bg-red-500'
                                        : 'bg-amber-500'
                                }`}
                                style={{ width: `${stats.mappingPercentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Botão de ação */}
                    {onMapClick && (
                        <button
                            onClick={onMapClick}
                            className={`mt-4 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                alertColor === 'red'
                                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                            }`}
                        >
                            Mapear Contas Agora
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

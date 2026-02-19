import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dreMappingService } from '../services/dreMappingService';

interface UnmappedAccount {
    id: string;
    code: string;
    name: string;
    category?: string;
    level: number;
}

interface UnmappedAccountsModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    year: number;
    type: 'dre' | 'patrimonial';
    onMappingComplete?: () => void;
}

export const UnmappedAccountsModal: React.FC<UnmappedAccountsModalProps> = ({
    isOpen,
    onClose,
    clientId,
    year,
    type,
    onMappingComplete,
}) => {
    const [unmappedAccounts, setUnmappedAccounts] = useState<UnmappedAccount[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const validCategories = dreMappingService.getValidCategories();

    useEffect(() => {
        if (isOpen) {
            loadUnmappedAccounts();
        }
    }, [isOpen, clientId, year, type]);

    const loadUnmappedAccounts = async () => {
        try {
            setIsLoading(true);
            const accounts = await dreMappingService.getUnmappedMovements(clientId, year, type);
            setUnmappedAccounts(accounts);
            // Inicializar mapeamentos vazios
            const initialMappings: Record<string, string> = {};
            accounts.forEach(acc => {
                initialMappings[acc.code] = '';
            });
            setMappings(initialMappings);
        } catch (error) {
            console.error('Erro ao carregar contas não mapeadas:', error);
            toast.error('Erro ao carregar contas não mapeadas');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveMappings = async () => {
        // Validar se todas as contas foram mapeadas
        const unmappedCodes = Object.entries(mappings)
            .filter(([_, category]) => !category)
            .map(([code, _]) => code);

        if (unmappedCodes.length > 0) {
            toast.error(`${unmappedCodes.length} conta(s) ainda não foram mapeadas`);
            return;
        }

        try {
            setIsSaving(true);
            const mappingsArray = unmappedAccounts.map(acc => ({
                account_code: acc.code,
                account_name: acc.name,
                category: mappings[acc.code],
            }));

            await dreMappingService.bulkImport(clientId, mappingsArray);
            toast.success(`${mappingsArray.length} conta(s) mapeada(s) com sucesso`);
            onMappingComplete?.();
            onClose();
        } catch (error) {
            console.error('Erro ao salvar mapeamentos:', error);
            toast.error('Erro ao salvar mapeamentos');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d1829] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                        <div>
                            <h3 className="text-lg font-bold text-white">Contas Não Mapeadas</h3>
                            <p className="text-xs text-white/40 mt-1">
                                {unmappedAccounts.length} conta(s) precisam ser classificadas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white/40" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                        </div>
                    ) : unmappedAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                            <p className="text-white/60">Todas as contas estão mapeadas!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {unmappedAccounts.map(account => (
                                <div
                                    key={account.code}
                                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-500/30 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-sm font-mono text-cyan-400">{account.code}</p>
                                            <p className="text-sm text-white font-medium mt-1">{account.name}</p>
                                        </div>
                                        {mappings[account.code] && (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                        )}
                                    </div>
                                    <select
                                        value={mappings[account.code] || ''}
                                        onChange={(e) =>
                                            setMappings(prev => ({
                                                ...prev,
                                                [account.code]: e.target.value,
                                            }))
                                        }
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all"
                                    >
                                        <option value="">Selecione uma categoria...</option>
                                        {validCategories.map(cat => (
                                            <option key={cat} value={cat} className="bg-[#0d1829]">
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                        Cancelar
                    </button>
                    {unmappedAccounts.length > 0 && (
                        <button
                            onClick={handleSaveMappings}
                            disabled={isSaving}
                            className="px-6 py-2.5 text-sm font-bold bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Salvar Mapeamentos
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

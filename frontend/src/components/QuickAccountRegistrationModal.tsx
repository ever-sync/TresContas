import React, { useState } from 'react';
import { X, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { dreMappingService } from '../services/dreMappingService';

interface QuickAccountRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    suggestedCode?: string;
    suggestedName?: string;
    onAccountCreated?: () => void;
}

export const QuickAccountRegistrationModal: React.FC<QuickAccountRegistrationModalProps> = ({
    isOpen,
    onClose,
    clientId,
    suggestedCode = '',
    suggestedName = '',
    onAccountCreated,
}) => {
    const [formData, setFormData] = useState({
        code: suggestedCode,
        name: suggestedName,
        category: '',
        level: '15',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const validCategories = dreMappingService.getValidCategories();

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.code.trim()) {
            errors.code = 'Classificador é obrigatório';
        } else if (!/^\d+(\.\d+)*$/.test(formData.code.trim())) {
            errors.code = 'Classificador deve conter apenas números e pontos (ex: 03.1.01.01.0001)';
        }

        if (!formData.name.trim()) {
            errors.name = 'Nome da conta é obrigatório';
        }

        if (!formData.category.trim()) {
            errors.category = 'Categoria é obrigatória';
        }

        if (!formData.level) {
            errors.level = 'Nível é obrigatório';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Verifique os erros no formulário');
            return;
        }

        try {
            setIsLoading(true);

            // Criar mapeamento DRE
            await dreMappingService.createOrUpdate(
                clientId,
                formData.code.trim(),
                formData.name.trim(),
                formData.category.trim()
            );

            toast.success('Conta registrada com sucesso!');
            onAccountCreated?.();
            
            // Resetar formulário
            setFormData({
                code: '',
                name: '',
                category: '',
                level: '15',
            });
            setValidationErrors({});
            onClose();
        } catch (error: any) {
            console.error('Erro ao registrar conta:', error);
            toast.error(error?.response?.data?.message || 'Erro ao registrar conta');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d1829] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <Plus className="w-5 h-5 text-cyan-400" />
                        <div>
                            <h3 className="text-lg font-bold text-white">Registrar Nova Conta</h3>
                            <p className="text-xs text-white/40 mt-1">
                                Adicione uma nova conta ao Plano de Contas
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
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Classificador */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Classificador (Código)
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: 03.1.01.01.0001"
                            value={formData.code}
                            onChange={(e) => {
                                setFormData(prev => ({ ...prev, code: e.target.value }));
                                if (validationErrors.code) {
                                    setValidationErrors(prev => ({ ...prev, code: '' }));
                                }
                            }}
                            className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:border-cyan-500/30 transition-all placeholder:text-white/20 ${
                                validationErrors.code
                                    ? 'border-red-500/30 focus:ring-red-500/30'
                                    : 'border-white/10 focus:ring-cyan-500/30'
                            }`}
                        />
                        {validationErrors.code && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {validationErrors.code}
                            </p>
                        )}
                    </div>

                    {/* Nome da Conta */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Nome da Conta
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: RECEITA DE VENDAS"
                            value={formData.name}
                            onChange={(e) => {
                                setFormData(prev => ({ ...prev, name: e.target.value }));
                                if (validationErrors.name) {
                                    setValidationErrors(prev => ({ ...prev, name: '' }));
                                }
                            }}
                            className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:border-cyan-500/30 transition-all placeholder:text-white/20 ${
                                validationErrors.name
                                    ? 'border-red-500/30 focus:ring-red-500/30'
                                    : 'border-white/10 focus:ring-cyan-500/30'
                            }`}
                        />
                        {validationErrors.name && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {validationErrors.name}
                            </p>
                        )}
                    </div>

                    {/* Nível */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Nível
                        </label>
                        <select
                            value={formData.level}
                            onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all"
                        >
                            <option value="1" className="bg-[#0d1829]">Nível 1 - Grupo Principal</option>
                            <option value="4" className="bg-[#0d1829]">Nível 4 - Subgrupo</option>
                            <option value="7" className="bg-[#0d1829]">Nível 7 - Conta Sintética</option>
                            <option value="10" className="bg-[#0d1829]">Nível 10 - Subconta Sintética</option>
                            <option value="15" className="bg-[#0d1829]">Nível 15 - Conta Analítica</option>
                        </select>
                        <p className="text-xs text-white/40 mt-1">
                            Contas analíticas (nível 15) são usadas para lançamentos reais
                        </p>
                    </div>

                    {/* Categoria */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Categoria (DE-PARA)
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => {
                                setFormData(prev => ({ ...prev, category: e.target.value }));
                                if (validationErrors.category) {
                                    setValidationErrors(prev => ({ ...prev, category: '' }));
                                }
                            }}
                            className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:border-cyan-500/30 transition-all ${
                                validationErrors.category
                                    ? 'border-red-500/30 focus:ring-red-500/30'
                                    : 'border-white/10 focus:ring-cyan-500/30'
                            }`}
                        >
                            <option value="">Selecione uma categoria...</option>
                            {validCategories.map(cat => (
                                <option key={cat} value={cat} className="bg-[#0d1829]">
                                    {cat}
                                </option>
                            ))}
                        </select>
                        {validationErrors.category && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {validationErrors.category}
                            </p>
                        )}
                        <p className="text-xs text-white/40 mt-1">
                            Escolha a categoria de relatório para esta conta
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 mt-4">
                        <p className="text-xs text-cyan-300 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                                Esta conta será adicionada ao Plano de Contas e poderá receber movimentações mensais.
                            </span>
                        </p>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-white/[0.02]">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-6 py-2.5 text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-6 py-2.5 text-sm font-bold bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLoading ? 'Registrando...' : 'Registrar Conta'}
                    </button>
                </div>
            </div>
        </div>
    );
};

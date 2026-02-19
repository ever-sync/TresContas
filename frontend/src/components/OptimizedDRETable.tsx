import React, { useState, useMemo } from 'react';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { DRECalculationService, MovementRow, DREResult } from '../services/dreCalculationService';

interface DRELineItem {
    id: string;
    name: string;
    key: keyof DREResult;
    type: 'positive' | 'negative' | 'main' | 'highlight';
    category?: string;
}

interface OptimizedDRETableProps {
    movements: MovementRow[];
    selectedMonthIndex: number;
    months: string[];
    isReadOnly?: boolean;
    comments?: Record<string, string>;
    onCommentChange?: (itemId: string, comment: string) => void;
}

const DRE_LINES: DRELineItem[] = [
    { id: 'rec_bruta', name: 'Receita Bruta', key: 'recBruta', type: 'positive', category: 'Receita Bruta' },
    { id: 'deducoes', name: 'Deduções', key: 'deducoes', type: 'negative', category: 'Deduções' },
    { id: 'rec_liquida', name: 'RECEITA LIQUIDA', key: 'recLiquida', type: 'main' },
    { id: 'custos', name: 'Custos Das Vendas', key: 'custos', type: 'negative', category: 'Custos Das Vendas' },
    { id: 'lucro_bruto', name: 'LUCRO BRUTO', key: 'lucroBruto', type: 'main' },
    { id: 'desp_adm', name: 'Despesas Administrativas', key: 'despAdm', type: 'negative', category: 'Despesas Administrativas' },
    { id: 'desp_com', name: 'Despesas Comerciais', key: 'despCom', type: 'negative', category: 'Despesas Comerciais' },
    { id: 'desp_trib', name: 'Despesas Tributarias', key: 'despTrib', type: 'negative', category: 'Despesas Tributarias' },
    { id: 'desp_outras', name: 'Outras Despesas', key: 'despOutras', type: 'negative', category: 'Outras Despesas' },
    { id: 'outras_receitas', name: 'Outras Receitas', key: 'outrasReceitas', type: 'positive', category: 'Outras Receitas' },
    { id: 'rec_fin', name: 'Receitas Financeiras', key: 'recFin', type: 'positive', category: 'Receitas Financeiras' },
    { id: 'desp_fin', name: 'Despesas Financeiras', key: 'despFin', type: 'negative', category: 'Despesas Financeiras' },
    { id: 'lair', name: 'LUCRO ANTES DO IRPJ E CSLL', key: 'lair', type: 'main' },
    { id: 'irpj_csll', name: 'Irpj E Csll', key: 'irpjCsll', type: 'negative', category: 'Irpj E Csll' },
    { id: 'lucro_liq', name: 'LUCRO/PREJUÍZO LIQUIDO', key: 'lucroLiq', type: 'highlight' },
    { id: 'ebtida', name: 'RESULTADO EBTIDA', key: 'ebtida', type: 'highlight' },
];

export const OptimizedDRETable: React.FC<OptimizedDRETableProps> = ({
    movements,
    selectedMonthIndex,
    months,
    isReadOnly = false,
    comments = {},
    onCommentChange,
}) => {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Calcular DRE para todos os meses
    const allMonthsDre = useMemo(() => {
        return DRECalculationService.calculateDREForAllMonths(movements);
    }, [movements]);

    // Preparar dados da tabela
    const reportItems = useMemo(() => {
        const currentMonthData = allMonthsDre[selectedMonthIndex];
        const recBruta = currentMonthData.recBruta;

        return DRE_LINES.map(line => ({
            ...line,
            value: currentMonthData[line.key],
            formattedValue: DRECalculationService.formatNumber(currentMonthData[line.key]),
            percentage: DRECalculationService.calculatePercentage(currentMonthData[line.key], recBruta),
            accumulated: allMonthsDre.reduce((sum, d) => sum + d[line.key], 0),
        }));
    }, [allMonthsDre, selectedMonthIndex]);

    const toggleRow = (itemId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
        } else {
            newExpanded.add(itemId);
        }
        setExpandedRows(newExpanded);
    };

    const getChildAccounts = (category: string | undefined) => {
        if (!category) return [];
        return DRECalculationService.getChildAccountsByCategory(category, movements);
    };

    return (
        <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                        <th className="p-4 px-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[260px] sticky left-0 z-20 bg-[#0a1628]">
                            Indicador
                        </th>
                        {months.map((m, i) => (
                            <th
                                key={m}
                                className={`p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[100px] ${
                                    i === selectedMonthIndex ? 'bg-cyan-500/10 text-cyan-400' : ''
                                }`}
                            >
                                {m}
                            </th>
                        ))}
                        <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[110px] bg-white/5 sticky right-[100px] z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">
                            Acumulado
                        </th>
                        <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[70px] sticky right-0 z-20 bg-[#0a1628] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">
                            %
                        </th>
                        {!isReadOnly && (
                            <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[180px]">
                                Comentário
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {reportItems.map((item) => {
                        const hasChildren = Boolean(item.category);
                        const isExpanded = expandedRows.has(item.id);
                        const childAccounts = hasChildren ? getChildAccounts(item.category) : [];

                        return (
                            <React.Fragment key={item.id}>
                                {/* Linha principal */}
                                <tr
                                    className={`hover:bg-white/5 group transition-colors cursor-pointer ${
                                        item.type === 'main' ? 'bg-white/5 font-bold text-white' : 'text-white/60'
                                    } ${item.type === 'highlight' ? 'bg-cyan-500/10 font-black text-white' : ''}`}
                                    onClick={() => hasChildren && toggleRow(item.id)}
                                >
                                    <td className="p-4 px-6 text-sm flex items-center gap-2 sticky left-0 z-10 bg-[#0a1628]">
                                        {hasChildren && (
                                            <span className={`text-[10px] text-cyan-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                ▶
                                            </span>
                                        )}
                                        <div
                                            className={`w-2 h-2 rounded-full shrink-0 ${
                                                item.type === 'positive'
                                                    ? 'bg-emerald-500'
                                                    : item.type === 'negative'
                                                    ? 'bg-rose-500'
                                                    : item.type === 'main'
                                                    ? 'bg-cyan-400'
                                                    : 'bg-white/10'
                                            }`}
                                        />
                                        {item.name}
                                    </td>
                                    {months.map((_, mi) => {
                                        const monthVal = allMonthsDre[mi][item.key];
                                        const prevVal = mi > 0 ? allMonthsDre[mi - 1][item.key] : null;
                                        const growth = prevVal ? ((monthVal - prevVal) / Math.abs(prevVal)) * 100 : null;

                                        return (
                                            <td
                                                key={mi}
                                                className={`p-4 px-3 text-xs text-right font-mono font-bold ${
                                                    mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''
                                                } ${
                                                    item.type === 'negative'
                                                        ? 'text-rose-400'
                                                        : item.type === 'positive'
                                                        ? 'text-emerald-400'
                                                        : 'text-white/80'
                                                }`}
                                                title={growth ? `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs mês anterior` : ''}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    {DRECalculationService.formatNumber(monthVal)}
                                                    {growth && (
                                                        <span className={`text-[8px] ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className={`p-4 px-3 text-xs text-right font-mono font-bold bg-white/5 sticky right-[100px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] ${
                                        item.type === 'highlight' ? 'text-cyan-400' : 'text-white'
                                    }`}>
                                        {DRECalculationService.formatNumber(item.accumulated)}
                                    </td>
                                    <td className={`p-4 px-3 text-xs text-right font-black sticky right-0 z-10 bg-[#0a1628] shadow-[-4px_0_10px_rgba(0,0,0,0.3)] ${
                                        item.percentage.startsWith('-') ? 'text-rose-400' : 'text-cyan-400'
                                    }`}>
                                        {item.percentage}
                                    </td>
                                    {!isReadOnly && (
                                        <td className="p-2 px-3">
                                            <input
                                                className="w-full bg-white/5 border border-white/5 rounded-lg px-2 py-1 text-[11px] text-white/60 outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all placeholder:text-white/10"
                                                placeholder="Nota..."
                                                value={comments[item.id] || ''}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => onCommentChange?.(item.id, e.target.value)}
                                            />
                                        </td>
                                    )}
                                </tr>

                                {/* Linhas de drill-down */}
                                {isExpanded &&
                                    childAccounts.map((child) => {
                                        const childTotal = child.values.reduce((s, v) => s + v, 0);
                                        return (
                                            <tr key={`${item.id}-${child.code}`} className="bg-white/[0.02] text-white/40 text-xs">
                                                <td className="p-3 px-6 sticky left-0 z-10 bg-[#0b1520]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-cyan-400/60 font-mono text-[10px]">{child.code}</span>
                                                        <span className="truncate">{child.name}</span>
                                                    </div>
                                                </td>
                                                {months.map((_, mi) => (
                                                    <td key={mi} className="p-3 px-3 text-right font-mono">
                                                        {DRECalculationService.formatNumber(child.values[mi] || 0)}
                                                    </td>
                                                ))}
                                                <td className="p-3 px-3 text-right font-mono bg-white/[0.02] sticky right-[100px] z-10">
                                                    {DRECalculationService.formatNumber(childTotal)}
                                                </td>
                                                <td className="p-3 px-3 text-right sticky right-0 z-10 bg-[#0b1520]" />
                                                {!isReadOnly && <td className="p-3 px-3" />}
                                            </tr>
                                        );
                                    })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

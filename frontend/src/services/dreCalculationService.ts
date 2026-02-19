import { CATEGORY_ALIASES, normalizeCategory } from '../lib/categoryConstants';

export interface MovementRow {
    code: string;
    name: string;
    level: number;
    values: number[];
    category?: string;
}

export interface DREResult {
    recBruta: number;
    deducoes: number;
    recLiquida: number;
    custos: number;
    lucroBruto: number;
    despAdm: number;
    despCom: number;
    despTrib: number;
    despOutras: number;
    outrasReceitas: number;
    recFin: number;
    despFin: number;
    lair: number;
    irpjCsll: number;
    lucroLiq: number;
    ebtida: number;
}

/**
 * Serviço otimizado para cálculo do DRE
 * Suporta normalização de categorias com aliases
 */
export class DRECalculationService {
    /**
     * Normaliza um nome de categoria para o formato canônico
     * Suporta aliases e variações
     */
    private static normalizeCategory(categoryName: string): string {
        if (!categoryName) return '';
        
        const normalized = categoryName.trim().toLowerCase();
        
        // Buscar no mapeamento de aliases
        for (const [key, aliases] of Object.entries(CATEGORY_ALIASES)) {
            if (aliases.includes(normalized)) {
                return key;
            }
        }
        
        return normalized;
    }

    /**
     * Soma movimentações por categoria, com suporte a aliases
     * Evita dupla contagem somando apenas o nível mais analítico
     */
    static getSumByCategory(
        categoryName: string,
        monthIdx: number,
        movements: MovementRow[]
    ): number {
        const normalizedCategory = this.normalizeCategory(categoryName);
        
        if (!normalizedCategory) return 0;

        // Buscar movimentações que correspondem a essa categoria (direto ou por alias)
        const matched = movements.filter(m => {
            if (!m.category) return false;
            const movNormalized = this.normalizeCategory(m.category);
            return movNormalized === normalizedCategory;
        });

        if (matched.length === 0) return 0;

        // Evitar dupla contagem: somar apenas o nível mais analítico
        const maxLevel = Math.max(...matched.map(m => m.level));
        return matched
            .filter(m => m.level === maxLevel)
            .reduce((sum, m) => sum + (m.values[monthIdx] || 0), 0);
    }

    /**
     * Calcula o DRE para um mês específico
     */
    static calculateDREForMonth(
        monthIdx: number,
        movements: MovementRow[]
    ): DREResult {
        const getSumByCategory = (cat: string) => this.getSumByCategory(cat, monthIdx, movements);

        // Receitas
        const recBruta = getSumByCategory('Receita Bruta');
        const deducoes = getSumByCategory('Deduções');
        const recLiquida = recBruta - deducoes;

        // Custos
        const custos = getSumByCategory('Custos Das Vendas');
        const lucroBruto = recLiquida - custos;

        // Despesas Operacionais
        const despAdm = getSumByCategory('Despesas Administrativas');
        const despCom = getSumByCategory('Despesas Comerciais');
        const despTrib = getSumByCategory('Despesas Tributarias');
        const despOutras = getSumByCategory('Outras Despesas');

        // Receitas/Despesas Financeiras
        const outrasReceitas = getSumByCategory('Outras Receitas');
        const recFin = getSumByCategory('Receitas Financeiras');
        const despFin = getSumByCategory('Despesas Financeiras');

        // Resultado Operacional
        const lair = lucroBruto - despAdm - despCom - despTrib - despOutras + outrasReceitas + recFin - despFin;

        // Impostos
        const irpjCsll = getSumByCategory('Irpj E Csll');

        // Resultado Líquido
        const lucroLiq = lair - irpjCsll;

        // EBITDA
        const depreciacao = getSumByCategory('Depreciação e Amortização');
        const ebtida = lair - (recFin - despFin) + Math.abs(depreciacao);

        return {
            recBruta,
            deducoes,
            recLiquida,
            custos,
            lucroBruto,
            despAdm,
            despCom,
            despTrib,
            despOutras,
            outrasReceitas,
            recFin,
            despFin,
            lair,
            irpjCsll,
            lucroLiq,
            ebtida,
        };
    }

    /**
     * Calcula o DRE para todos os meses
     */
    static calculateDREForAllMonths(movements: MovementRow[]): DREResult[] {
        return Array.from({ length: 12 }, (_, idx) =>
            this.calculateDREForMonth(idx, movements)
        );
    }

    /**
     * Busca contas filhas de uma categoria para drill-down
     */
    static getChildAccountsByCategory(
        categoryName: string,
        movements: MovementRow[]
    ): MovementRow[] {
        const normalizedCategory = this.normalizeCategory(categoryName);
        
        if (!normalizedCategory) return [];

        return movements.filter(m => {
            if (!m.category) return false;
            const movNormalized = this.normalizeCategory(m.category);
            return movNormalized === normalizedCategory;
        });
    }

    /**
     * Valida se uma movimentação está corretamente mapeada
     */
    static isProperlyMapped(movement: MovementRow): boolean {
        if (!movement.category) return false;
        if (movement.category === '#REF!' || movement.category === '#REF') return false;
        
        const normalized = this.normalizeCategory(movement.category);
        return normalized !== '' && normalized !== movement.category.toLowerCase();
    }

    /**
     * Retorna estatísticas de mapeamento
     */
    static getMappingStats(movements: MovementRow[]): {
        total: number;
        mapped: number;
        unmapped: number;
        mappingPercentage: number;
    } {
        const total = movements.length;
        const mapped = movements.filter(m => this.isProperlyMapped(m)).length;
        const unmapped = total - mapped;
        const mappingPercentage = total > 0 ? (mapped / total) * 100 : 0;

        return {
            total,
            mapped,
            unmapped,
            mappingPercentage,
        };
    }

    /**
     * Formata um número para o padrão brasileiro (R$ 1.234,56)
     */
    static formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }

    /**
     * Formata um número sem símbolo de moeda
     */
    static formatNumber(value: number): string {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }

    /**
     * Calcula percentual em relação à receita bruta
     */
    static calculatePercentage(value: number, recBruta: number): string {
        if (recBruta === 0) return '0%';
        return `${Math.round((value / recBruta) * 100)}%`;
    }

    /**
     * Identifica contas não mapeadas em um conjunto de movimentações
     */
    static getUnmappedAccounts(movements: MovementRow[]): MovementRow[] {
        return movements.filter(m => !this.isProperlyMapped(m) && m.level === 15);
    }
}

/**
 * Hook para usar o serviço de cálculo do DRE
 * Exemplo de uso:
 * 
 * const dreService = useDRECalculation();
 * const dre = dreService.calculateDREForMonth(0, movements);
 */
export const useDRECalculation = () => {
    return {
        calculateDREForMonth: (monthIdx: number, movements: MovementRow[]) =>
            DRECalculationService.calculateDREForMonth(monthIdx, movements),
        
        calculateDREForAllMonths: (movements: MovementRow[]) =>
            DRECalculationService.calculateDREForAllMonths(movements),
        
        getChildAccountsByCategory: (categoryName: string, movements: MovementRow[]) =>
            DRECalculationService.getChildAccountsByCategory(categoryName, movements),
        
        isProperlyMapped: (movement: MovementRow) =>
            DRECalculationService.isProperlyMapped(movement),
        
        getMappingStats: (movements: MovementRow[]) =>
            DRECalculationService.getMappingStats(movements),
        
        formatCurrency: (value: number) =>
            DRECalculationService.formatCurrency(value),
        
        formatNumber: (value: number) =>
            DRECalculationService.formatNumber(value),
        
        calculatePercentage: (value: number, recBruta: number) =>
            DRECalculationService.calculatePercentage(value, recBruta),
        
        getUnmappedAccounts: (movements: MovementRow[]) =>
            DRECalculationService.getUnmappedAccounts(movements),
    };
};

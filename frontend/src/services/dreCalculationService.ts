import { CATEGORY_ALIASES, normalizeCategory, removeDiacritics } from '../lib/categoryConstants';

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
 * Respeita os sinais originais (débito/crédito) das contas
 */
export class DRECalculationService {
    /**
     * Normaliza um nome de categoria para o formato canônico
     * Suporta aliases e variações, incluindo encoding incorreto
     */
    private static normalizeCategoryInternal(categoryName: string): string | null {
        if (!categoryName) return null;
        
        // Usar a função de normalização do categoryConstants que já trata encoding
        return normalizeCategory(categoryName);
    }

    /**
     * Soma movimentações por categoria, com suporte a aliases
     * Evita dupla contagem somando apenas o nível mais analítico
     * IMPORTANTE: Respeita os sinais originais (positivos/negativos)
     */
    static getSumByCategory(
        categoryName: string,
        monthIdx: number,
        movements: MovementRow[]
    ): number {
        const normalizedCategory = this.normalizeCategoryInternal(categoryName);
        
        if (!normalizedCategory) return 0;

        // Buscar movimentações que correspondem a essa categoria (direto ou por alias)
        const matched = movements.filter(m => {
            if (!m.category) return false;
            const movNormalized = this.normalizeCategoryInternal(m.category);
            return movNormalized === normalizedCategory;
        });

        if (matched.length === 0) return 0;

        // Evitar dupla contagem: somar apenas o nível mais analítico
        const maxLevel = Math.max(...matched.map(m => m.level));
        
        // IMPORTANTE: Somar respeitando os sinais originais (não usar Math.abs)
        return matched
            .filter(m => m.level === maxLevel)
            .reduce((sum, m) => sum + (m.values[monthIdx] || 0), 0);
    }

    /**
     * Calcula o DRE para um mês específico
     * Respeita os sinais originais das contas (débito/crédito)
     */
    static calculateDREForMonth(
        monthIdx: number,
        movements: MovementRow[]
    ): DREResult {
        const getSumByCategory = (cat: string) => this.getSumByCategory(cat, monthIdx, movements);

        // Receitas (podem incluir deduções com sinal negativo)
        const recBruta = getSumByCategory('Receita Bruta');
        
        // Deduções (já vêm com sinal negativo da planilha, então subtraímos)
        const deducoes = getSumByCategory('Deduções');
        
        // Receita Líquida = Receita Bruta - Deduções
        // Se deduções vêm negativas, isso é: recBruta - (-valor) = recBruta + valor
        // Se deduções vêm positivas, isso é: recBruta - valor
        const recLiquida = recBruta - deducoes;

        // Custos (vêm com sinal negativo da planilha)
        const custos = getSumByCategory('Custos Das Vendas');
        
        // Lucro Bruto = Receita Líquida - Custos
        // Se custos vêm negativos: recLiquida - (-valor) = recLiquida + valor
        const lucroBruto = recLiquida - custos;

        // Despesas Operacionais (vêm com sinal negativo da planilha)
        const despAdm = getSumByCategory('Despesas Administrativas');
        const despCom = getSumByCategory('Despesas Comerciais');
        const despTrib = getSumByCategory('Despesas Tributarias');
        const despOutras = getSumByCategory('Outras Despesas');

        // Receitas/Despesas Financeiras
        const outrasReceitas = getSumByCategory('Outras Receitas');
        const recFin = getSumByCategory('Receitas Financeiras');
        const despFin = getSumByCategory('Despesas Financeiras');

        // Resultado Operacional (LAIR)
        // LAIR = Lucro Bruto - Despesas Operacionais + Outras Receitas + Receitas Fin - Despesas Fin
        // Como despesas vêm negativas: Lucro Bruto - (-valor) = Lucro Bruto + valor
        const lair = lucroBruto - despAdm - despCom - despTrib - despOutras + outrasReceitas + recFin - despFin;

        // Impostos (IRPJ e CSLL)
        const irpjCsll = getSumByCategory('Irpj E Csll');

        // Resultado Líquido
        const lucroLiq = lair - irpjCsll;

        // EBITDA (Lucro Operacional + Depreciação/Amortização)
        const depreciacao = getSumByCategory('Depreciação e Amortização');
        const ebtida = lair + depreciacao;

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
        const normalizedCategory = this.normalizeCategoryInternal(categoryName);
        
        if (!normalizedCategory) return [];

        return movements.filter(m => {
            if (!m.category) return false;
            const movNormalized = this.normalizeCategoryInternal(m.category);
            return movNormalized === normalizedCategory;
        });
    }

    /**
     * Valida se uma movimentação está corretamente mapeada
     */
    static isProperlyMapped(movement: MovementRow): boolean {
        if (!movement.category) return false;
        if (movement.category === '#REF!' || movement.category === '#REF') return false;
        
        const normalized = this.normalizeCategoryInternal(movement.category);
        return normalized !== null && normalized !== '';
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

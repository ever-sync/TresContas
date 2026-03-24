import {
    CATEGORY_ALIASES,
    VALID_CATEGORIES,
    debugNormalization,
    getCanonicalCategory,
    getCategoryDisplayLabel,
    isValidCategory,
    normalizeCategory,
    removeDiacritics,
} from '../src/lib/categoryConstants';

describe('categoryConstants', () => {
    it('normalizes diacritics and aliases to canonical categories', () => {
        expect(removeDiacritics('Deduções de Vendas')).toBe('deducoes de vendas');
        expect(normalizeCategory('Deduções de Vendas')).toBe('Deducoes');
        expect(getCanonicalCategory('depreciação e amortização')).toBe('Depreciacao E Amortizacao');
    });

    it('keeps the canonical category list aligned with backend validation', () => {
        expect(VALID_CATEGORIES).toContain('Deducoes');
        expect(VALID_CATEGORIES).toContain('Depreciacao E Amortizacao');
        expect(isValidCategory('Receita Bruta')).toBe(true);
        expect(isValidCategory('Deduções')).toBe(true);
    });

    it('exposes useful normalization diagnostics', () => {
        const result = debugNormalization('  cmv  ');
        expect(result.withoutDiacritics).toBe('cmv');
        expect(result.normalized).toBe('Custos Das Vendas');
        expect(result.isValid).toBe(true);
    });

    it('keeps alias mapping populated', () => {
        expect(CATEGORY_ALIASES.cmv).toBe('Custos Das Vendas');
    });

    it('renders friendly labels for canonical categories', () => {
        expect(getCategoryDisplayLabel('Deducoes')).toBe('Deduções');
        expect(getCategoryDisplayLabel('Contas A Pagar Cp')).toBe('Contas a Pagar CP');
        expect(getCategoryDisplayLabel('Receita Bruta')).toBe('Receita Bruta');
    });
});

import { DRECalculationService } from '../src/services/dreCalculationService';

describe('DRECalculationService', () => {
    it('normalizes categories before calculating sums', () => {
        const movements = [
            {
                code: '1',
                name: 'Receita de vendas',
                level: 15,
                values: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                category: 'Receita Bruta',
            },
            {
                code: '2',
                name: 'Devolucoes',
                level: 15,
                values: [-10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                category: 'Deduções de Vendas',
            },
            {
                code: '3',
                name: 'Depreciacao',
                level: 15,
                values: [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                category: 'depreciação e amortização',
            },
        ];

        expect(DRECalculationService.getSumByCategory('Deducoes', 0, movements)).toBe(-10);
        expect(DRECalculationService.getSumByCategory('Depreciacao E Amortizacao', 0, movements)).toBe(5);
        expect(DRECalculationService.calculateDREForMonth(0, movements).recLiquida).toBe(110);
    });
});

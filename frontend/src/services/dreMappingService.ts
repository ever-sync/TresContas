import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface DREMapping {
    id: string;
    account_code: string;
    account_name: string;
    category: string;
    created_at: string;
    updated_at: string;
}

export interface UnmappedMovement {
    id: string;
    code: string;
    name: string;
    category?: string;
    level: number;
}

const VALID_CATEGORIES = [
    'Adiantamentos', 'Clientes', 'Contas A Pagar Cp', 'Custos Das Vendas', 'Deduções',
    'Despesas Administrativas', 'Despesas Antecipadas', 'Despesas Comerciais', 'Despesas Financeiras',
    'Despesas Tributarias', 'Disponivel', 'Emprestimos E Financiamentos Cp', 'Estoques', 'Fornecedores',
    'Imobilizado', 'Intangivel', 'Irpj E Csll', 'Obrigacoes Trabalhistas', 'Obrigacoes Tributarias',
    'Outras Contas A Pagar Lp', 'Outras Contas A Receber Lp', 'Outras Receitas', 'Parcelamentos Cp',
    'Parcelamentos Lp', 'Processos Judiciais', 'Receita Bruta', 'Receitas Financeiras',
    'Reserva De Lucros', 'Resultado Do Exercicio', 'Tributos A CompensarCP'
];

export const dreMappingService = {
    /**
     * Retorna todas as categorias válidas para mapeamento
     */
    getValidCategories: () => VALID_CATEGORIES,

    /**
     * Busca todos os mapeamentos DRE para um cliente
     */
    getAll: async (clientId: string): Promise<DREMapping[]> => {
        const response = await axios.get(`${API_BASE_URL}/clients/${clientId}/dre-mappings`);
        return response.data;
    },

    /**
     * Cria ou atualiza um mapeamento DRE
     */
    createOrUpdate: async (
        clientId: string,
        accountCode: string,
        accountName: string,
        category: string
    ): Promise<DREMapping> => {
        const response = await axios.post(`${API_BASE_URL}/clients/${clientId}/dre-mappings`, {
            account_code: accountCode,
            account_name: accountName,
            category,
        });
        return response.data.mapping;
    },

    /**
     * Remove um mapeamento DRE
     */
    delete: async (clientId: string, accountCode: string): Promise<void> => {
        await axios.delete(`${API_BASE_URL}/clients/${clientId}/dre-mappings/${accountCode}`);
    },

    /**
     * Busca movimentações não mapeadas
     */
    getUnmappedMovements: async (
        clientId: string,
        year: number,
        type: 'dre' | 'patrimonial' = 'dre'
    ): Promise<UnmappedMovement[]> => {
        const response = await axios.get(
            `${API_BASE_URL}/clients/${clientId}/unmapped-movements?year=${year}&type=${type}`
        );
        return response.data;
    },

    /**
     * Importa múltiplos mapeamentos DRE em uma única requisição
     */
    bulkImport: async (
        clientId: string,
        mappings: Array<{ account_code: string; account_name: string; category: string }>
    ): Promise<{ count: number }> => {
        const response = await axios.post(`${API_BASE_URL}/clients/${clientId}/bulk-dre-mappings`, {
            mappings,
        });
        return response.data;
    },
};

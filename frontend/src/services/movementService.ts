import api from './api';

export type MovementType = 'dre' | 'patrimonial';

export interface MovementRow {
    id?: string;
    code: string;
    name: string;
    level: number;
    category?: string; // DE-PARA: "Receita Bruta", "Custos das Vendas", etc.
    values: number[]; // 12 valores: [jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez]
    type?: MovementType;
}

export interface ImportMovementPayload {
    year: number;
    movements: Omit<MovementRow, 'id'>[];
    type: MovementType;
}

export const movementService = {
    /**
     * Busca movimentações de um cliente para um determinado ano e tipo.
     */
    getAll: async (clientId: string, year: number, type?: MovementType): Promise<MovementRow[]> => {
        const params: any = { year };
        if (type) params.type = type;
        const response = await api.get(`/clients/${clientId}/movements`, { params });
        return response.data;
    },

    /**
     * Importa (substitui) as movimentações de um cliente para um ano e tipo.
     */
    bulkImport: async (
        clientId: string,
        year: number,
        movements: Omit<MovementRow, 'id'>[],
        type: MovementType = 'dre'
    ): Promise<{ message: string; count: number; year: number }> => {
        const response = await api.post(`/clients/${clientId}/movements/import`, {
            year,
            movements,
            type,
        });
        return response.data;
    },

    /**
     * Remove todas as movimentações de um cliente para um determinado ano e tipo.
     */
    removeAll: async (clientId: string, year: number, type?: MovementType): Promise<{ message: string; count: number }> => {
        const params: any = { year };
        if (type) params.type = type;
        const response = await api.delete(`/clients/${clientId}/movements`, { params });
        return response.data;
    },
};

import api from './api';
import { VALID_CATEGORIES } from '../lib/categoryConstants';

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

export const dreMappingService = {
    /**
     * Returns all valid categories for mapping.
     */
    getValidCategories: () => VALID_CATEGORIES,

    /**
     * Fetches all DRE mappings for a client.
     */
    getAll: async (clientId: string): Promise<DREMapping[]> => {
        const response = await api.get(`/clients/${clientId}/dre-mappings`);
        return response.data;
    },

    /**
     * Creates or updates a DRE mapping.
     */
    createOrUpdate: async (
        clientId: string,
        accountCode: string,
        accountName: string,
        category: string
    ): Promise<DREMapping> => {
        const response = await api.post(`/clients/${clientId}/dre-mappings`, {
            account_code: accountCode,
            account_name: accountName,
            category,
        });
        return response.data.mapping;
    },

    /**
     * Removes a DRE mapping.
     */
    delete: async (clientId: string, accountCode: string): Promise<void> => {
        await api.delete(`/clients/${clientId}/dre-mappings/${accountCode}`);
    },

    /**
     * Fetches unmapped movements.
     */
    getUnmappedMovements: async (
        clientId: string,
        year: number,
        type: 'dre' | 'patrimonial' = 'dre'
    ): Promise<UnmappedMovement[]> => {
        const response = await api.get(`/clients/${clientId}/unmapped-movements`, {
            params: { year, type },
        });
        return response.data;
    },

    /**
     * Bulk imports DRE mappings in a single request.
     */
    bulkImport: async (
        clientId: string,
        mappings: Array<{ account_code: string; account_name: string; category: string }>
    ): Promise<{ count: number }> => {
        const response = await api.post(`/clients/${clientId}/bulk-dre-mappings`, {
            mappings,
        });
        return response.data;
    },
};

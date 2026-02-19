import api from './api';
import clientApi from './clientApi';

export interface ChartAccount {
    id: string;
    code: string;
    name: string;
    level: number;
    type: string;
    alias: string | null;
    report_type: string | null;
    report_category: string | null;
    is_analytic: boolean;
    created_at?: string;
}

export interface ImportAccount {
    code: string;
    name: string;
    level: number;
    type: string;
    alias?: string;
    report_type?: string;
    report_category?: string;
}

/** Staff-side service (uses accounting auth token) */
export const chartOfAccountsService = {
    getAll: async (clientId: string): Promise<ChartAccount[]> => {
        const response = await api.get(`/clients/${clientId}/chart-of-accounts`);
        return response.data;
    },

    bulkImport: async (clientId: string, accounts: ImportAccount[]): Promise<{ message: string; count: number }> => {
        const response = await api.post(`/clients/${clientId}/chart-of-accounts/import`, { accounts });
        return response.data;
    },

    create: async (clientId: string, data: ImportAccount): Promise<ChartAccount> => {
        const response = await api.post(`/clients/${clientId}/chart-of-accounts`, data);
        return response.data;
    },

    remove: async (clientId: string, id: string): Promise<void> => {
        await api.delete(`/clients/${clientId}/chart-of-accounts/${id}`);
    },

    removeAll: async (clientId: string): Promise<{ message: string; count: number }> => {
        const response = await api.delete(`/clients/${clientId}/chart-of-accounts`);
        return response.data;
    },
};

/** Client-portal service (uses client auth token) */
export const clientChartOfAccountsService = {
    getAll: async (): Promise<ChartAccount[]> => {
        const response = await clientApi.get('/client-portal/chart-of-accounts');
        return response.data;
    },
};

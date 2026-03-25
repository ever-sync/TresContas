import api from './api';
import clientApi from './clientApi';

export type DFCSourceType = 'dre' | 'asset' | 'liability' | 'equity' | 'cash';
export type DFCDisplayType = 'item' | 'result';

export interface DFCEligibleAccount {
    id: string;
    code: string;
    reduced_code: string | null;
    name: string;
    type: string;
    is_analytic: boolean | null;
    level: number;
}

export interface DFCConfigLine {
    key: string;
    label: string;
    section: string;
    order: number;
    displayType: DFCDisplayType;
    configurable: boolean;
    visibleInReport: boolean;
    sourceType?: DFCSourceType;
    consolidatedInto?: string;
    defaultMultiplier?: number;
    includeChildrenByDefault?: boolean;
    description?: string;
    isDerived: boolean;
}

export interface DFCConfigMapping {
    id?: string;
    line_key: string;
    chart_account_id: string;
    account_code_snapshot: string;
    reduced_code_snapshot: string | null;
    source_type: string;
    multiplier: number;
    include_children: boolean;
    chart_account: DFCEligibleAccount;
}

export interface DFCConfigResponse {
    lines: DFCConfigLine[];
    eligibleAccounts: DFCEligibleAccount[];
    mappings: DFCConfigMapping[];
}

export interface DFCWarning {
    code: string;
    severity: 'info' | 'warning';
    message: string;
    monthIndex?: number;
}

export interface DFCReportRow {
    type: 'section' | 'line' | 'separator';
    key?: string;
    label?: string;
    displayType?: DFCDisplayType;
    values?: Array<number | null>;
    configurable?: boolean;
    isDerived?: boolean;
}

export interface DFCReportResponse {
    year: number;
    partial: boolean;
    warnings: DFCWarning[];
    rows: DFCReportRow[];
}

export interface SaveDFCConfigPayload {
    mappings: Array<{
        line_key: string;
        chart_account_id: string;
        multiplier?: number;
        include_children?: boolean;
    }>;
}

export const dfcService = {
    getConfig: async (clientId: string): Promise<DFCConfigResponse> => {
        const response = await api.get(`/clients/${clientId}/dfc-config`);
        return response.data;
    },

    getAccountingConfig: async (): Promise<DFCConfigResponse> => {
        const response = await api.get('/accounting/dfc-config');
        return response.data;
    },

    saveConfig: async (clientId: string, payload: SaveDFCConfigPayload): Promise<DFCConfigResponse> => {
        const response = await api.put(`/clients/${clientId}/dfc-config`, payload);
        return response.data;
    },

    saveAccountingConfig: async (payload: SaveDFCConfigPayload): Promise<DFCConfigResponse> => {
        const response = await api.put('/accounting/dfc-config', payload);
        return response.data;
    },

    getReport: async (clientId: string, year: number): Promise<DFCReportResponse> => {
        const response = await api.get(`/clients/${clientId}/dfc`, {
            params: { year },
        });
        return response.data;
    },
};

export const clientPortalDfcService = {
    getReport: async (year: number): Promise<DFCReportResponse> => {
        const response = await clientApi.get('/client-portal/dfc', {
            params: { year },
        });
        return response.data;
    },
};

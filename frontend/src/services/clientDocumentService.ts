import api from './api';
import clientApi from './clientApi';

export interface ClientDocument {
    id: string;
    original_name: string;
    display_name: string;
    category: string;
    document_type: string;
    period_year: number | null;
    period_month: number | null;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    updated_at: string;
}

export interface StaffClientDocument extends ClientDocument {
    client: {
        id: string;
        name: string;
        cnpj: string;
    };
}

export interface UploadClientDocumentPayload {
    file: File;
    display_name: string;
    category: string;
    document_type?: string;
    period_year?: number;
    period_month?: number;
    client_id?: string;
}

export interface ListStaffClientDocumentsOptions {
    clientId?: string;
    documentType?: string;
}

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
};

export const clientDocumentService = {
    listForStaff: async (options: ListStaffClientDocumentsOptions = {}): Promise<StaffClientDocument[]> => {
        const response = await api.get('/client-documents', {
            params: {
                clientId: options.clientId,
                documentType: options.documentType,
            },
        });
        return response.data;
    },

    downloadForStaff: async (id: string, fileName: string) => {
        const response = await api.get(`/client-documents/${id}/download`, {
            responseType: 'blob',
        });
        downloadBlob(response.data, fileName);
    },

    listForClient: async (): Promise<ClientDocument[]> => {
        const response = await clientApi.get('/client-portal/documents');
        return response.data;
    },

    uploadForClient: async (payload: UploadClientDocumentPayload): Promise<ClientDocument> => {
        const formData = new FormData();
        formData.append('document', payload.file, payload.file.name);
        formData.append('display_name', payload.display_name);
        formData.append('category', payload.category);
        if (payload.document_type) {
            formData.append('document_type', payload.document_type);
        }
        if (typeof payload.period_year === 'number') {
            formData.append('period_year', String(payload.period_year));
        }
        if (typeof payload.period_month === 'number') {
            formData.append('period_month', String(payload.period_month));
        }

        const response = await clientApi.post('/client-portal/documents', formData);
        return response.data;
    },

    uploadForStaff: async (payload: UploadClientDocumentPayload): Promise<StaffClientDocument> => {
        const formData = new FormData();
        formData.append('document', payload.file, payload.file.name);
        formData.append('display_name', payload.display_name);
        formData.append('category', payload.category);
        if (payload.client_id) {
            formData.append('client_id', payload.client_id);
        }
        if (payload.document_type) {
            formData.append('document_type', payload.document_type);
        }
        if (typeof payload.period_year === 'number') {
            formData.append('period_year', String(payload.period_year));
        }
        if (typeof payload.period_month === 'number') {
            formData.append('period_month', String(payload.period_month));
        }

        const response = await api.post('/client-documents', formData);
        return response.data;
    },

    uploadBalanceteForStaff: async (
        clientId: string,
        payload: Omit<UploadClientDocumentPayload, 'client_id'>
    ): Promise<StaffClientDocument> => {
        const formData = new FormData();
        formData.append('document', payload.file, payload.file.name);
        formData.append('display_name', payload.display_name);
        formData.append('category', payload.category);
        if (payload.document_type) {
            formData.append('document_type', payload.document_type);
        }
        if (typeof payload.period_year === 'number') {
            formData.append('period_year', String(payload.period_year));
        }
        if (typeof payload.period_month === 'number') {
            formData.append('period_month', String(payload.period_month));
        }

        const response = await api.post(`/client-documents/clients/${clientId}`, formData);
        return response.data;
    },

    downloadForClient: async (id: string, fileName: string) => {
        const response = await clientApi.get(`/client-portal/documents/${id}/download`, {
            responseType: 'blob',
        });
        downloadBlob(response.data, fileName);
    },
};

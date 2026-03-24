import api from './api';
import clientApi from './clientApi';

export interface ClientDocument {
    id: string;
    original_name: string;
    display_name: string;
    category: string;
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
    listForStaff: async (): Promise<StaffClientDocument[]> => {
        const response = await api.get('/client-documents');
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

        const response = await clientApi.post('/client-portal/documents', formData);
        return response.data;
    },

    downloadForClient: async (id: string, fileName: string) => {
        const response = await clientApi.get(`/client-portal/documents/${id}/download`, {
            responseType: 'blob',
        });
        downloadBlob(response.data, fileName);
    },
};

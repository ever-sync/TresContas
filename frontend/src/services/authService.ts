import axios from 'axios';
import { resolveApiBaseUrl } from './baseUrl';
import type {
    ClientAuthResponse,
    StaffAuthResponse,
    StaffAuthUser,
} from './authTypes';
import { useAuthStore } from '../stores/useAuthStore';
import { useClientAuthStore } from '../stores/useClientAuthStore';

export interface ClientPortalUser {
    id: string;
    name: string;
    cnpj: string;
    email: string | null;
    status: string;
    accounting_id: string;
}

export interface AccountActionResponse {
    message: string;
    debug_token?: string | null;
    debug_link?: string | null;
    invite_token?: string | null;
    invite_link?: string | null;
}

const baseURL = resolveApiBaseUrl();

const staffAuthApi = axios.create({
    baseURL,
    withCredentials: true,
});

const clientAuthApi = axios.create({
    baseURL,
    withCredentials: true,
});

const isUnauthorizedError = (error: unknown) =>
    axios.isAxiosError(error) && error.response?.status === 401;

export const authService = {
    loginStaff: async (data: { email: string; password: string }): Promise<StaffAuthResponse> => {
        const response = await staffAuthApi.post<StaffAuthResponse>('/auth/login', data);
        return response.data;
    },

    registerStaff: async (data: {
        name: string;
        cnpj: string;
        email: string;
        phone: string;
        password: string;
    }): Promise<StaffAuthResponse> => {
        const response = await staffAuthApi.post<StaffAuthResponse>('/auth/register', data);
        return response.data;
    },

    getStaffMe: async (): Promise<StaffAuthUser> => {
        try {
            const response = await staffAuthApi.get<StaffAuthUser>('/auth/me');
            return response.data;
        } catch (error) {
            if (!isUnauthorizedError(error)) {
                throw error;
            }

            try {
                await authService.refreshStaffSession();
                const response = await staffAuthApi.get<StaffAuthUser>('/auth/me');
                return response.data;
            } catch (refreshError) {
                useAuthStore.getState().logout();
                throw refreshError;
            }
        }
    },

    refreshStaffSession: async (): Promise<StaffAuthResponse> => {
        const response = await staffAuthApi.post<StaffAuthResponse>('/auth/refresh');
        return response.data;
    },

    logoutStaffSession: async (): Promise<void> => {
        await staffAuthApi.post('/auth/logout');
    },

    forgotPassword: async (email: string): Promise<AccountActionResponse> => {
        const response = await staffAuthApi.post<AccountActionResponse>('/auth/forgot-password', { email });
        return response.data;
    },

    resetPassword: async (data: { token: string; password: string }): Promise<AccountActionResponse> => {
        const response = await staffAuthApi.post<AccountActionResponse>('/auth/reset-password', data);
        return response.data;
    },

    acceptInvite: async (data: { token: string; password: string }): Promise<AccountActionResponse> => {
        const response = await staffAuthApi.post<AccountActionResponse>('/auth/accept-invite', data);
        return response.data;
    },

    loginClient: async (data: {
        client_id?: string;
        identifier: string;
        password: string;
    }): Promise<ClientAuthResponse> => {
        const payload: { client_id?: string; email?: string; cnpj?: string; password: string } = {
            password: data.password,
        };
        if (data.client_id) payload.client_id = data.client_id;
        if (data.identifier.includes('@')) {
            payload.email = data.identifier.trim();
        } else {
            payload.cnpj = data.identifier.replace(/\D/g, '');
        }
        const response = await clientAuthApi.post<ClientAuthResponse>('/auth/client-login', payload);
        return response.data;
    },

    getClientMe: async (): Promise<ClientPortalUser> => {
        try {
            const response = await clientAuthApi.get<ClientPortalUser>('/client-portal/me');
            return response.data;
        } catch (error) {
            if (!isUnauthorizedError(error)) {
                throw error;
            }

            try {
                await authService.refreshClientSession();
                const response = await clientAuthApi.get<ClientPortalUser>('/client-portal/me');
                return response.data;
            } catch (refreshError) {
                useClientAuthStore.getState().logout();
                throw refreshError;
            }
        }
    },

    refreshClientSession: async (): Promise<ClientAuthResponse> => {
        const response = await clientAuthApi.post<ClientAuthResponse>('/auth/client-refresh');
        return response.data;
    },

    logoutClientSession: async (): Promise<void> => {
        await clientAuthApi.post('/auth/client-logout');
    },
};

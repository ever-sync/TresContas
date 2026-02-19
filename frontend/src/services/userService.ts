import api from './api';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'collaborator';
    status: 'active' | 'invited' | 'inactive';
    phone: string | null;
    avatar_url: string | null;
    accounting_id: string;
    created_at: string;
    updated_at: string;
}

export interface CreateUserData {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'collaborator';
    phone?: string;
}

export interface UpdateUserData {
    name?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'collaborator';
    status?: 'active' | 'invited' | 'inactive';
    phone?: string;
}

export const userService = {
    getAll: async (): Promise<User[]> => {
        const response = await api.get('/users');
        return response.data;
    },
    getById: async (id: string): Promise<User> => {
        const response = await api.get(`/users/${id}`);
        return response.data;
    },
    create: async (data: CreateUserData): Promise<User> => {
        const response = await api.post('/users', data);
        return response.data;
    },
    update: async (id: string, data: UpdateUserData): Promise<User> => {
        const response = await api.patch(`/users/${id}`, data);
        return response.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/users/${id}`);
    },
};

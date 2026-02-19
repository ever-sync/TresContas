
import api from './api';

export interface Client {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  address: string | null;
  status: string;
  tax_regime: string | null;
  representative_email: string | null;
  representative_name: string | null;
  accounting_id: string;
  created_at: string;
  updated_at: string;
}

export const clientService = {
  getAll: async (): Promise<Client[]> => {
    const response = await api.get('/clients');
    return response.data;
  },
  getById: async (id: string): Promise<Client> => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },
  create: async (data: Partial<Client> & { password?: string }): Promise<Client> => {
    const response = await api.post('/clients', data);
    return response.data;
  },
  update: async (id: string, data: Partial<Client>): Promise<Client> => {
    const response = await api.patch(`/clients/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
};

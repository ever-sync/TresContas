import clientApi from './clientApi';

export interface ClientPortalUser {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
  status: string;
  accounting_id: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const clientPortalService = {
  login: async (data: {
    client_id?: string;
    identifier: string;
    password: string;
  }): Promise<{ token: string; client: ClientPortalUser }> => {
    const payload: { client_id?: string; email?: string; cnpj?: string; password: string } = {
      password: data.password,
    };
    if (data.client_id) payload.client_id = data.client_id;
    if (data.identifier.includes('@')) {
      payload.email = data.identifier.trim();
    } else {
      payload.cnpj = data.identifier.replace(/\D/g, '');
    }
    const response = await clientApi.post('/auth/client-login', payload);
    return response.data;
  },

  getMe: async (): Promise<ClientPortalUser> => {
    const response = await clientApi.get('/client-portal/me');
    return response.data;
  },

  /** Busca tickets de suporte do cliente logado no portal */
  getSupportTickets: async (): Promise<SupportTicket[]> => {
    const response = await clientApi.get('/client-portal/support');
    return response.data;
  },

  /** Cria um novo ticket de suporte pelo portal do cliente */
  createSupportTicket: async (data: {
    subject: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
  }): Promise<SupportTicket> => {
    const response = await clientApi.post('/client-portal/support', data);
    return response.data;
  },
};

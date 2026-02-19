import api from './api';

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  client: {
    id: string;
    name: string;
    cnpj: string;
    industry: string | null;
  };
}

export const supportService = {
  getAll: async (status?: SupportTicket['status']): Promise<SupportTicket[]> => {
    const response = await api.get('/support', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },
  create: async (data: {
    client_id: string;
    subject: string;
    message: string;
    priority: SupportTicket['priority'];
  }): Promise<SupportTicket> => {
    const response = await api.post('/support', data);
    return response.data;
  },
  updateStatus: async (id: string, status: SupportTicket['status']): Promise<SupportTicket> => {
    const response = await api.patch(`/support/${id}`, { status });
    return response.data;
  },
};

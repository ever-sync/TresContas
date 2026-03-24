import api from './api';

export interface AuditEvent {
    id: string;
    actor_type: string | null;
    actor_role: string | null;
    actor_id: string | null;
    accounting_id: string | null;
    client_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    request_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    updated_at: string;
}

export interface AuditEventsFilter {
    action?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    clientId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
}

export const auditService = {
    getAll: async (params: AuditEventsFilter = {}): Promise<AuditEvent[]> => {
        const response = await api.get('/audit-events', { params });
        return response.data;
    },
};

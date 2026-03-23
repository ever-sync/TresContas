export interface StaffAuthUser {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'collaborator';
    accountingId: string;
    accountingName: string;
    cnpj: string;
}

export interface ClientAuthUser {
    id: string;
    name: string;
    cnpj: string;
    email: string | null;
}

export interface StaffAuthResponse {
    token: string;
    expires_at: string;
    user: StaffAuthUser;
}

export interface ClientAuthResponse {
    token: string;
    expires_at: string;
    client: ClientAuthUser;
}


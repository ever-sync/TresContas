import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapAuthSessions, handleUnauthorizedClientSession, handleUnauthorizedStaffSession } from '../src/lib/authSession';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useClientAuthStore } from '../src/stores/useClientAuthStore';

const authServiceMock = vi.hoisted(() => ({
    getStaffMe: vi.fn(),
    getClientMe: vi.fn(),
}));

vi.mock('../src/services/authService', () => ({
    authService: authServiceMock,
}));

const resetStores = () => {
    useAuthStore.setState({
        user: null,
        status: 'unknown',
    });

    useClientAuthStore.setState({
        client: null,
        status: 'unknown',
    });
};

describe('authSession', () => {
    beforeEach(() => {
        resetStores();
        authServiceMock.getStaffMe.mockReset();
        authServiceMock.getClientMe.mockReset();
        vi.stubGlobal('window', {
            location: {
                pathname: '/',
                assign: vi.fn(),
            },
        } as unknown as Window);
    });

    afterEach(() => {
        resetStores();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('bootstraps staff and client sessions from the backend', async () => {
        authServiceMock.getStaffMe.mockResolvedValue({
            id: 'staff-1',
            name: 'Ana',
            email: 'ana@example.com',
            role: 'admin',
            accountingId: 'acc-1',
            accountingName: 'TresContas',
            cnpj: '12345678000199',
        });
        authServiceMock.getClientMe.mockResolvedValue({
            id: 'client-1',
            name: 'Cliente',
            cnpj: '12345678000199',
            email: 'client@example.com',
            status: 'active',
            accounting_id: 'acc-1',
        });

        await bootstrapAuthSessions();

        expect(useAuthStore.getState().status).toBe('authenticated');
        expect(useAuthStore.getState().user?.name).toBe('Ana');
        expect(useClientAuthStore.getState().status).toBe('authenticated');
        expect(useClientAuthStore.getState().client?.name).toBe('Cliente');
    });

    it('clears staff sessions on unauthorized responses', () => {
        useAuthStore.setState({
            user: {
                id: 'staff-1',
                name: 'Ana',
                email: 'ana@example.com',
                role: 'admin',
                accountingId: 'acc-1',
                accountingName: 'TresContas',
                cnpj: '12345678000199',
            },
            status: 'authenticated',
        });

        handleUnauthorizedStaffSession();

        expect(useAuthStore.getState().status).toBe('anonymous');
        expect(useAuthStore.getState().user).toBeNull();
    });

    it('clears client sessions on unauthorized responses', () => {
        useClientAuthStore.setState({
            client: {
                id: 'client-1',
                name: 'Cliente',
                cnpj: '12345678000199',
                email: 'client@example.com',
            },
            status: 'authenticated',
        });

        handleUnauthorizedClientSession();

        expect(useClientAuthStore.getState().status).toBe('anonymous');
        expect(useClientAuthStore.getState().client).toBeNull();
    });
});

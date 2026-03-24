import { clearExpiredSessions, isSessionExpired } from '../src/lib/authSession';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useClientAuthStore } from '../src/stores/useClientAuthStore';

const resetStores = () => {
    useAuthStore.setState({
        user: null,
        token: null,
        expiresAt: null,
    });

    useClientAuthStore.setState({
        client: null,
        token: null,
        expiresAt: null,
    });
};

describe('authSession', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-23T12:00:00-03:00'));
        resetStores();
    });

    afterEach(() => {
        resetStores();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('detects valid and expired sessions', () => {
        expect(isSessionExpired('2026-03-23T12:00:01-03:00')).toBe(false);
        expect(isSessionExpired('2026-03-23T11:59:59-03:00')).toBe(true);
        expect(isSessionExpired('invalid-date')).toBe(true);
        expect(isSessionExpired(null)).toBe(true);
    });

    it('clears expired staff sessions without touching valid client sessions', () => {
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
            token: 'staff-token',
            expiresAt: '2026-03-23T11:59:59-03:00',
        });

        useClientAuthStore.setState({
            client: {
                id: 'client-1',
                name: 'Cliente',
                cnpj: '12345678000199',
                email: 'client@example.com',
            },
            token: 'client-token',
            expiresAt: '2026-03-23T12:30:00-03:00',
        });

        clearExpiredSessions();

        expect(useAuthStore.getState().token).toBeNull();
        expect(useAuthStore.getState().user).toBeNull();
        expect(useClientAuthStore.getState().token).toBe('client-token');
        expect(useClientAuthStore.getState().client?.name).toBe('Cliente');
    });

    it('clears expired client sessions without touching valid staff sessions', () => {
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
            token: 'staff-token',
            expiresAt: '2026-03-23T12:30:00-03:00',
        });

        useClientAuthStore.setState({
            client: {
                id: 'client-1',
                name: 'Cliente',
                cnpj: '12345678000199',
                email: 'client@example.com',
            },
            token: 'client-token',
            expiresAt: '2026-03-23T11:59:59-03:00',
        });

        clearExpiredSessions();

        expect(useClientAuthStore.getState().token).toBeNull();
        expect(useClientAuthStore.getState().client).toBeNull();
        expect(useAuthStore.getState().token).toBe('staff-token');
        expect(useAuthStore.getState().user?.name).toBe('Ana');
    });
});

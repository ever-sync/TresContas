import { useAuthStore } from '../stores/useAuthStore';
import { useClientAuthStore } from '../stores/useClientAuthStore';

export const isSessionExpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return true;

    const expiresAtMs = Date.parse(expiresAt);
    if (Number.isNaN(expiresAtMs)) return true;

    return expiresAtMs <= Date.now();
};

const redirectTo = (path: string) => {
    if (typeof window === 'undefined' || window.location.pathname === path) {
        return;
    }

    window.location.assign(path);
};

export const clearExpiredSessions = () => {
    const staffSession = useAuthStore.getState();
    if ((staffSession.token || staffSession.user) && isSessionExpired(staffSession.expiresAt)) {
        staffSession.logout();
    }

    const clientSession = useClientAuthStore.getState();
    if ((clientSession.token || clientSession.client) && isSessionExpired(clientSession.expiresAt)) {
        clientSession.logout();
    }
};

const hasValidStaffSession = () => {
    const session = useAuthStore.getState();
    return Boolean(session.token && session.user && !isSessionExpired(session.expiresAt));
};

const hasValidClientSession = () => {
    const session = useClientAuthStore.getState();
    return Boolean(session.token && session.client && !isSessionExpired(session.expiresAt));
};

export const getStaffTokenForRequest = (requestUrl?: string) => {
    if (requestUrl?.startsWith('/auth/')) {
        return null;
    }

    if (!hasValidStaffSession()) {
        const hadSession = Boolean(useAuthStore.getState().token || useAuthStore.getState().user);
        useAuthStore.getState().logout();
        if (hadSession) {
            redirectTo('/login');
        }
        return null;
    }

    return useAuthStore.getState().token;
};

export const getClientTokenForRequest = (requestUrl?: string) => {
    if (requestUrl?.startsWith('/auth/')) {
        return null;
    }

    if (!hasValidClientSession()) {
        const hadSession = Boolean(useClientAuthStore.getState().token || useClientAuthStore.getState().client);
        useClientAuthStore.getState().logout();
        if (hadSession) {
            redirectTo('/client-login');
        }
        return null;
    }

    return useClientAuthStore.getState().token;
};

export const handleUnauthorizedStaffSession = () => {
    const hadSession = hasValidStaffSession();
    useAuthStore.getState().logout();
    if (hadSession) {
        redirectTo('/login');
    }
};

export const handleUnauthorizedClientSession = () => {
    const hadSession = hasValidClientSession();
    useClientAuthStore.getState().logout();
    if (hadSession) {
        redirectTo('/client-login');
    }
};


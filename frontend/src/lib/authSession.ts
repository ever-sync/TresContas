import { useAuthStore } from '../stores/useAuthStore';
import { useClientAuthStore } from '../stores/useClientAuthStore';
import { authService } from '../services/authService';

const redirectTo = (path: string) => {
    if (typeof window === 'undefined' || window.location.pathname === path) {
        return;
    }

    window.location.assign(path);
};

export const clearStaffSession = () => {
    useAuthStore.getState().logout();
};

export const clearClientSession = () => {
    useClientAuthStore.getState().logout();
};

export const handleUnauthorizedStaffSession = () => {
    const hadSession = useAuthStore.getState().status === 'authenticated';
    clearStaffSession();

    if (hadSession) {
        redirectTo('/login');
    }
};

export const handleUnauthorizedClientSession = () => {
    const hadSession = useClientAuthStore.getState().status === 'authenticated';
    clearClientSession();

    if (hadSession) {
        redirectTo('/client-login');
    }
};

export const bootstrapStaffSession = async () => {
    try {
        const user = await authService.getStaffMe();
        useAuthStore.getState().setSession(user);
    } catch {
        clearStaffSession();
    }
};

export const bootstrapClientSession = async () => {
    try {
        const client = await authService.getClientMe();
        useClientAuthStore.getState().setSession(client);
    } catch {
        clearClientSession();
    }
};

export const bootstrapAuthSessions = async () => {
    await Promise.allSettled([bootstrapStaffSession(), bootstrapClientSession()]);
};

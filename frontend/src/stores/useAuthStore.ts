import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StaffAuthUser } from '../services/authTypes';
import { clearStaffQueryCache } from '../lib/queryClient';
import { sessionStorageJSON } from '../lib/persistStorage';

export type User = StaffAuthUser;

interface AuthState {
    user: User | null;
    token: string | null;
    expiresAt: string | null;
    setAuth: (user: User, token: string, expiresAt: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            expiresAt: null,
            setAuth: (user, token, expiresAt) => set({ user, token, expiresAt }),
            logout: () => {
                clearStaffQueryCache();
                set({ user: null, token: null, expiresAt: null });
            },
        }),
        {
            name: 'trescontas-auth',
            storage: sessionStorageJSON,
        }
    )
);

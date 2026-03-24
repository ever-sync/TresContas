import { create } from 'zustand';
import type { StaffAuthUser } from '../services/authTypes';
import { clearStaffQueryCache } from '../lib/queryClient';

export type User = StaffAuthUser;

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
    user: User | null;
    status: AuthStatus;
    setSession: (user: User) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    status: 'unknown',
    setSession: (user) => set({ user, status: 'authenticated' }),
    logout: () => {
        clearStaffQueryCache();
        set({ user: null, status: 'anonymous' });
    },
}));

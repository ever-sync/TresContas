import { create } from 'zustand';
import type { ClientAuthUser } from '../services/authTypes';
import { clearClientQueryCache } from '../lib/queryClient';

export type ClientUser = ClientAuthUser;

export type ClientAuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface ClientAuthState {
  client: ClientUser | null;
  status: ClientAuthStatus;
  setSession: (client: ClientUser) => void;
  logout: () => void;
}

export const useClientAuthStore = create<ClientAuthState>((set) => ({
  client: null,
  status: 'unknown',
  setSession: (client) => set({ client, status: 'authenticated' }),
  logout: () => {
    clearClientQueryCache();
    set({ client: null, status: 'anonymous' });
  },
}));

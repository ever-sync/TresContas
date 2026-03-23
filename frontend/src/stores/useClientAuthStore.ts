import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ClientAuthUser } from '../services/authTypes';

export type ClientUser = ClientAuthUser;

interface ClientAuthState {
  client: ClientUser | null;
  token: string | null;
  expiresAt: string | null;
  setAuth: (client: ClientUser, token: string, expiresAt: string) => void;
  logout: () => void;
}

export const useClientAuthStore = create<ClientAuthState>()(
  persist(
    (set) => ({
      client: null,
      token: null,
      expiresAt: null,
      setAuth: (client, token, expiresAt) => set({ client, token, expiresAt }),
      logout: () => set({ client: null, token: null, expiresAt: null }),
    }),
    {
      name: 'trescontas-client-auth',
    }
  )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ClientUser {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
}

interface ClientAuthState {
  client: ClientUser | null;
  token: string | null;
  setAuth: (client: ClientUser, token: string) => void;
  logout: () => void;
}

export const useClientAuthStore = create<ClientAuthState>()(
  persist(
    (set) => ({
      client: null,
      token: null,
      setAuth: (client, token) => set({ client, token }),
      logout: () => set({ client: null, token: null }),
    }),
    {
      name: 'trescontas-client-auth',
    }
  )
);

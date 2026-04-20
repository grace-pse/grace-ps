import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, extractError } from '../lib/api';

export type Role = 'ADMIN' | 'LEAD_ASSESSOR' | 'ASSESSOR' | 'REVIEWER' | 'STAKEHOLDER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  login: (input: { email: string; password: string; organizationSlug: string }) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
    organizationSlug: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

type AuthResponse = { token: string; user: User; organization: Organization };

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      organization: null,
      loading: false,

      login: async (input) => {
        set({ loading: true });
        try {
          const data = await api.post('auth/login', { json: input }).json<AuthResponse>();
          set({ token: data.token, user: data.user, organization: data.organization });
        } catch (err) {
          throw new Error(await extractError(err));
        } finally {
          set({ loading: false });
        }
      },

      register: async (input) => {
        set({ loading: true });
        try {
          const data = await api.post('auth/register', { json: input }).json<AuthResponse>();
          set({ token: data.token, user: data.user, organization: data.organization });
        } catch (err) {
          throw new Error(await extractError(err));
        } finally {
          set({ loading: false });
        }
      },

      logout: () => {
        set({ token: null, user: null, organization: null });
      },

      refresh: async () => {
        if (!get().token) return;
        try {
          const user = await api.get('auth/me').json<User & { organization: Organization }>();
          const { organization, ...u } = user;
          set({ user: u, organization });
        } catch {
          set({ token: null, user: null, organization: null });
        }
      },
    }),
    {
      name: 'csmp-auth',
      partialize: (s) => ({ token: s.token, user: s.user, organization: s.organization }),
    },
  ),
);

import { create } from 'zustand';
import { api } from '../lib/api';
import { useAuthStore, type Role } from './auth';
import {
  clearInvite,
  persistInvite,
  readInvite,
  readInviteFromUrl,
  stripInviteFromUrl,
} from '../lib/sandbox';

interface SandboxState {
  inviteToken: string | null;
  inviteLabel: string | null;
  status: 'idle' | 'verifying' | 'ready' | 'invalid' | 'error';
  errorMessage: string | null;
  bootstrap: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
}

interface LoginAsResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
  };
  organization: { id: string; name: string; slug: string };
  invite: { id: string; label: string };
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
  inviteToken: null,
  inviteLabel: null,
  status: 'idle',
  errorMessage: null,

  bootstrap: async () => {
    if (get().status === 'verifying' || get().status === 'ready') return;

    const fromUrl = readInviteFromUrl();
    if (fromUrl) {
      persistInvite(fromUrl);
      stripInviteFromUrl();
    }
    const token = fromUrl ?? readInvite();
    if (!token) {
      set({ status: 'invalid', errorMessage: 'This sandbox is invite-only.' });
      return;
    }

    set({ status: 'verifying', inviteToken: token, errorMessage: null });

    try {
      const resp = await api
        .post('sandbox/login-as', { json: { role: 'ADMIN', invite: token } })
        .json<LoginAsResponse>();
      useAuthStore.setState({
        token: resp.token,
        user: resp.user,
        organization: resp.organization,
      });
      set({
        inviteToken: token,
        inviteLabel: resp.invite.label,
        status: 'ready',
        errorMessage: null,
      });
    } catch (err) {
      clearInvite();
      const message =
        err instanceof Error ? err.message : 'Could not verify your invite.';
      set({
        status: 'invalid',
        errorMessage: message,
        inviteToken: null,
        inviteLabel: null,
      });
    }
  },

  switchRole: async (role) => {
    const token = get().inviteToken ?? readInvite();
    if (!token) {
      set({ status: 'invalid', errorMessage: 'Missing invite token' });
      return;
    }
    const resp = await api
      .post('sandbox/login-as', { json: { role, invite: token } })
      .json<LoginAsResponse>();
    useAuthStore.setState({
      token: resp.token,
      user: resp.user,
      organization: resp.organization,
    });
    set({ inviteLabel: resp.invite.label });
  },
}));

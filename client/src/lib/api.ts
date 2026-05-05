import ky, { HTTPError } from 'ky';
import { useAuthStore } from '../stores/auth';
import { isSandbox, readInvite } from './sandbox';

export const api = ky.create({
  prefixUrl: '/api',
  timeout: 15000,
  hooks: {
    beforeRequest: [
      (req) => {
        const token = useAuthStore.getState().token;
        if (token) req.headers.set('Authorization', `Bearer ${token}`);
        if (isSandbox()) {
          const invite = readInvite();
          if (invite) req.headers.set('X-Invite-Token', invite);
        }
      },
    ],
    afterResponse: [
      async (req, _opts, res) => {
        if (res.status !== 401) return;
        // Don't trigger logout/redirect on the auth probe endpoints themselves —
        // those legitimately return 401 and the caller handles it (login form,
        // sandbox bootstrap re-issue path).
        const url = new URL(req.url);
        if (
          url.pathname.endsWith('/api/auth/login') ||
          url.pathname.endsWith('/api/auth/register') ||
          url.pathname.endsWith('/api/sandbox/login-as') ||
          url.pathname.endsWith('/api/sandbox/verify-invite')
        ) {
          return;
        }
        if (isSandbox()) {
          // Re-issue a fresh JWT against the stored invite. The sandbox store
          // imports auth, so we lazy-load to avoid a top-level cycle.
          try {
            const { useSandboxStore } = await import('../stores/sandbox');
            await useSandboxStore.getState().bootstrap();
          } catch {
            /* noop */
          }
          return;
        }
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      },
    ],
  },
});

export async function extractError(err: unknown): Promise<string> {
  if (err instanceof HTTPError) {
    try {
      const body = (await err.response.clone().json()) as { error?: string };
      return body.error ?? err.message;
    } catch {
      return err.message;
    }
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

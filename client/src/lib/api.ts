import ky, { HTTPError } from 'ky';
import { useAuthStore } from '../stores/auth';

export const api = ky.create({
  prefixUrl: '/api',
  timeout: 15000,
  hooks: {
    beforeRequest: [
      (req) => {
        const token = useAuthStore.getState().token;
        if (token) req.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
    afterResponse: [
      (_req, _opts, res) => {
        if (res.status === 401) {
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
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

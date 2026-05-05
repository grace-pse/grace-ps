// Client-side sandbox helpers. The server is the source of truth for what
// "sandbox mode" means; this just toggles UI affordances (banner, auto-login,
// role switcher) and reads the build-time env flag.

const INVITE_LS_KEY = 'csmp.sandbox.invite';

export function isSandbox(): boolean {
  return import.meta.env.VITE_SANDBOX_MODE === 'true';
}

export function getResetIntervalHours(): number {
  const raw = import.meta.env.VITE_RESET_INTERVAL_HOURS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 48;
}

export function readInviteFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const t = params.get('invite');
  return t && t.length >= 8 ? t : null;
}

export function persistInvite(token: string): void {
  try {
    localStorage.setItem(INVITE_LS_KEY, token);
  } catch {
    /* noop */
  }
}

export function readInvite(): string | null {
  try {
    return localStorage.getItem(INVITE_LS_KEY);
  } catch {
    return null;
  }
}

export function clearInvite(): void {
  try {
    localStorage.removeItem(INVITE_LS_KEY);
  } catch {
    /* noop */
  }
}

export function stripInviteFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('invite')) return;
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url.toString());
}

export function formatCountdown(target: Date | null): string {
  if (!target) return 'reset time unknown';
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return 'resetting now…';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

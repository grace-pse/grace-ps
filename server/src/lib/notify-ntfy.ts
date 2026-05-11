// Fire-and-forget ntfy publisher. Mirrors notify-owner.ts:
//   * env-gated — no-op when NTFY_INVITE_URL is unset (prod / local dev)
//   * try/catch — never throws to the caller, never blocks login on a slow ntfy
//   * 5 s timeout — a stalled ntfy can't pile up open sockets

type NtfyPriority = 1 | 2 | 3 | 4 | 5;

export interface NtfyOptions {
  tags?: string[];
  priority?: NtfyPriority;
  click?: string;
}

export async function notifyNtfy(
  title: string,
  message: string,
  opts: NtfyOptions = {},
): Promise<void> {
  const url = process.env.NTFY_INVITE_URL;
  if (!url) return;

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    Title: title,
  };
  if (opts.tags && opts.tags.length > 0) headers.Tags = opts.tags.join(',');
  if (opts.priority) headers.Priority = String(opts.priority);
  if (opts.click) headers.Click = opts.click;

  const auth = process.env.NTFY_AUTH_HEADER;
  if (auth) headers.Authorization = auth;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[notify-ntfy] non-2xx from ntfy: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('[notify-ntfy] failed:', err);
  }
}

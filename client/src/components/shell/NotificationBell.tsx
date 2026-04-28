// P3 — bell icon with unread badge + dropdown of recent notifications.
// Polls unread-count every 30s to refresh the badge; fetches the last 20
// items when the popover opens. Click-through routes to the relevant
// survey when the payload includes a surveyResponseId.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Bell, Check, CircleAlert, AlertTriangle, Info } from 'lucide-react';

import { notificationsApi, type NotificationItem } from '../../lib/csmp-api';
import { Pill } from '../hifi/Pill';

const SEVERITY_ICON: Record<string, typeof Info> = {
  CRITICAL: CircleAlert,
  WARN: AlertTriangle,
  INFO: Info,
};

const SEVERITY_VARIANT: Record<string, 'bad' | 'warn' | 'info'> = {
  CRITICAL: 'bad',
  WARN: 'warn',
  INFO: 'info',
};

function kindLabel(kind: string) {
  return kind.replace(/_/g, ' ').toLowerCase();
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const r = await notificationsApi.unreadCount();
      setUnreadCount(r.unreadCount);
    } catch {
      // best-effort — ignore transient errors
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await notificationsApi.list({ limit: 20 });
      setItems(r.items);
      setUnreadCount(r.unreadCount);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const t = window.setInterval(() => void refreshCount(), 30_000);
    return () => window.clearInterval(t);
  }, [refreshCount]);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function handleItemClick(n: NotificationItem) {
    if (!n.readAt) {
      try {
        await notificationsApi.markRead(n.id);
        setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // best-effort
      }
    }
    const payload = (n.payload ?? null) as { surveyResponseId?: string } | null;
    if (payload?.surveyResponseId) {
      setOpen(false);
      await navigate({ to: '/surveys/$id', params: { id: payload.surveyResponseId } });
    }
  }

  async function handleMarkAll() {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // best-effort
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative w-8 h-8 flex items-center justify-center text-n-600 hover:bg-n-100 rounded-r1"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-bad text-white text-[9px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[380px] max-h-[480px] bg-white border border-n-150 rounded-r3 shadow-sh2 z-50 flex flex-col"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-n-150">
            <div className="text-[12.5px] font-semibold text-n-900">Notifications</div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[11px] text-a-700 hover:underline inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-[12px] text-n-500">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-n-500">No notifications yet.</div>
            ) : (
              items.map((n) => {
                const Icon = SEVERITY_ICON[n.severity] ?? Info;
                const variant = SEVERITY_VARIANT[n.severity] ?? 'info';
                const unread = !n.readAt;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void handleItemClick(n)}
                    className={[
                      'w-full text-left px-3 py-2.5 border-b border-n-100 hover:bg-n-50',
                      unread ? 'bg-a-50/40' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-2">
                      <Icon
                        className={[
                          'w-3.5 h-3.5 shrink-0 mt-0.5',
                          n.severity === 'CRITICAL'
                            ? 'text-bad'
                            : n.severity === 'WARN'
                            ? 'text-warn'
                            : 'text-info',
                        ].join(' ')}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Pill variant={variant}>{kindLabel(n.kind)}</Pill>
                          {unread && <span className="w-1.5 h-1.5 rounded-full bg-a-500" />}
                        </div>
                        <div className="text-[12px] font-medium text-n-900 truncate">{n.title}</div>
                        {n.body && (
                          <div className="text-[11px] text-n-600 mt-0.5 line-clamp-2">{n.body}</div>
                        )}
                        <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-1">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

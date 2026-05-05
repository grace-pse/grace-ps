import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCountdown, getResetIntervalHours } from '../../lib/sandbox';
import { useSandboxStore } from '../../stores/sandbox';
import { useFeedbackStore } from '../../stores/feedback';

interface SandboxStatus {
  sandboxMode: true;
  resetIntervalHours: number;
  lastResetAt: string | null;
  nextResetAt: string | null;
  serverTime: string;
}

export function DemoBanner() {
  const inviteLabel = useSandboxStore((s) => s.inviteLabel);
  const openFeedback = useFeedbackStore((s) => s.open);
  const [nextReset, setNextReset] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const s = await api.get('sandbox/status').json<SandboxStatus>();
        if (cancelled) return;
        setNextReset(s.nextResetAt ? new Date(s.nextResetAt) : null);
      } catch {
        /* tolerate transient failures */
      }
    };
    void fetchStatus();
    const poll = window.setInterval(fetchStatus, 60_000);
    const ticker = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(ticker);
    };
  }, []);

  const countdown = nextReset
    ? formatCountdown(nextReset)
    : `~${getResetIntervalHours()}h cycle (waiting for first reset)`;

  // tick is read so the countdown re-renders every minute even if nextReset
  // doesn't change.
  void tick;

  return (
    <div className="bg-a-600 text-white px-4 py-1.5 text-[12px] font-medium flex items-center gap-3 justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-1.5 py-0.5 bg-white/20 rounded-r1 text-[10px] font-mono uppercase tracking-[0.6px] shrink-0">
          Demo
        </span>
        <span className="truncate">
          All data resets in {countdown}.
          {inviteLabel ? <span className="opacity-80"> · {inviteLabel}</span> : null}
        </span>
      </div>
      <button
        type="button"
        onClick={openFeedback}
        className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-r1 text-[11.5px] font-medium transition-colors shrink-0"
      >
        Send feedback →
      </button>
    </div>
  );
}

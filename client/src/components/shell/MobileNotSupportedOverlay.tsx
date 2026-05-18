import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Btn2 } from '../hifi/Btn2';

const SUPPRESS_UNTIL_KEY = 'csmp-mobile-warning-dismissed-until';
const SUPPRESS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isSuppressed(): boolean {
  try {
    const raw = localStorage.getItem(SUPPRESS_UNTIL_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function MobileNotSupportedOverlay() {
  const isNarrow = useMediaQuery('(max-width: 767px)');
  const [dismissed, setDismissed] = useState<boolean>(() => isSuppressed());

  useEffect(() => {
    if (isNarrow && !dismissed && isSuppressed()) {
      setDismissed(true);
    }
  }, [isNarrow, dismissed]);

  if (!isNarrow || dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(
        SUPPRESS_UNTIL_KEY,
        String(Date.now() + SUPPRESS_DURATION_MS),
      );
    } catch {
      // localStorage unavailable (private mode etc.) — still dismiss for this session.
    }
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-n-900/40"
    >
      <div className="relative w-full max-w-sm bg-white border border-n-150 rounded-r3 shadow-sh1 p-5">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center text-n-400 hover:text-n-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-r2 shrink-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #4f56e5 0%, #3436a4 100%)',
            }}
          >
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              id="mobile-warning-title"
              className="text-[13.5px] font-semibold text-n-900"
            >
              Mobile experience not yet supported
            </div>
            <div className="text-[12px] text-n-600 mt-1.5 leading-relaxed">
              GRACE Engine is desktop-first. On phones, navigation, the
              relationship graph, and the assessment wizard will feel cramped
              and some controls may be hard to reach. For the best experience
              please open this on a tablet (≥ 768&nbsp;px) or a laptop.
            </div>
            <div className="text-[11px] text-n-500 mt-2">
              We&rsquo;re working on a proper mobile pass.
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Btn2 variant="primary" onClick={handleDismiss}>
            Continue anyway
          </Btn2>
        </div>
      </div>
    </div>
  );
}

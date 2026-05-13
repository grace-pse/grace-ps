import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Non-intrusive install prompt for PWA-capable browsers (Chrome/Edge/Opera).
 *
 * Behaviour:
 *  - Capture `beforeinstallprompt` event (browser-fired, app is installable).
 *  - Show toast only after the user has visited at least twice — avoids the
 *    "install on first page" pattern that drives uninstalls.
 *  - Dismiss suppresses the toast for 30 days via localStorage.
 *  - Once installed (`appinstalled` event) we never show again.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const VISIT_KEY = 'csmp-pwa-visits';
const SUPPRESS_UNTIL_KEY = 'csmp-pwa-install-suppressed-until';
const INSTALLED_KEY = 'csmp-pwa-installed';

function isSuppressed(): boolean {
  const raw = localStorage.getItem(SUPPRESS_UNTIL_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until)) return false;
  return Date.now() < until;
}

function bumpVisitCount(): number {
  const raw = localStorage.getItem(VISIT_KEY);
  const prev = raw ? Number(raw) : 0;
  const next = Number.isFinite(prev) ? prev + 1 : 1;
  localStorage.setItem(VISIT_KEY, String(next));
  return next;
}

export function InstallAppToast() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(INSTALLED_KEY) === '1') return;

    const visits = bumpVisitCount();

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      if (isSuppressed()) return;
      if (visits < 2) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    function onInstalled() {
      localStorage.setItem(INSTALLED_KEY, '1');
      setDeferred(null);
      setVisible(false);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'dismissed') {
      localStorage.setItem(
        SUPPRESS_UNTIL_KEY,
        String(Date.now() + 30 * 24 * 60 * 60 * 1000),
      );
    }
    setDeferred(null);
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(
      SUPPRESS_UNTIL_KEY,
      String(Date.now() + 30 * 24 * 60 * 60 * 1000),
    );
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-n-200 rounded-r2 shadow-lg p-4 flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-[6px] shrink-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #4f56e5 0%, #3436a4 100%)' }}
      >
        <Download className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-n-900">
          Install CSMP Risk Manager
        </div>
        <div className="text-[11.5px] text-n-600 mt-0.5">
          Launch from your home screen and keep working offline on-site.
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="h-7 px-3 rounded-r1 bg-a-600 text-white text-[11.5px] font-medium hover:bg-a-700"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="h-7 px-3 rounded-r1 text-n-600 text-[11.5px] font-medium hover:bg-n-100"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="w-5 h-5 flex items-center justify-center text-n-400 hover:text-n-600"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

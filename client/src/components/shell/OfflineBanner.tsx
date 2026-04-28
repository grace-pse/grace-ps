import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Thin amber bar above the app when the browser reports offline.
 * Reads from the service-worker cache keep working; writes are blocked by
 * the API layer and show their own toasts.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 h-7 bg-warn-bg text-warn text-[11.5px] font-medium border-b border-warn/20"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline — showing cached data. Writes are paused until you reconnect.</span>
    </div>
  );
}

import { useEffect, useState } from 'react';

/**
 * Reactive `navigator.onLine` with event subscription.
 * Note: `navigator.onLine` only tells you the OS thinks a network is available —
 * it doesn't guarantee the API is reachable. For our UX (show a banner, disable
 * writes) that's good enough.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

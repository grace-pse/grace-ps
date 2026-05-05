import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { registerSW } from 'virtual:pwa-register';
import { router } from './routes/router';
import { useAuthStore } from './stores/auth';
import { isSandbox } from './lib/sandbox';
import { SandboxBootstrap } from './components/sandbox/SandboxBootstrap';
import './styles/index.css';

// Register the PWA service worker. `registerType: 'autoUpdate'` in vite.config
// means new versions activate silently on next navigation — no prompt needed.
// No-op in dev because `devOptions.enabled = false`.
registerSW({ immediate: true });

function Boot() {
  const [ready, setReady] = useState(false);
  const refresh = useAuthStore((s) => s.refresh);
  const sandbox = isSandbox();

  useEffect(() => {
    if (sandbox) {
      // In sandbox mode the SandboxBootstrap component is responsible for
      // exchanging the invite token for a JWT — skip the /auth/me probe that
      // would race against it and trigger a logout on first load.
      setReady(true);
      return;
    }
    refresh().finally(() => setReady(true));
  }, [refresh, sandbox]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-n-50">
        <div className="text-[11.5px] font-mono text-n-500 tracking-[0.4px]">
          CSMP · loading…
        </div>
      </div>
    );
  }

  if (sandbox) {
    return (
      <SandboxBootstrap>
        <RouterProvider router={router} />
      </SandboxBootstrap>
    );
  }
  return <RouterProvider router={router} />;
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');
createRoot(rootEl).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);

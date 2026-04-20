import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/router';
import { useAuthStore } from './stores/auth';
import './styles/index.css';

function Boot() {
  const [ready, setReady] = useState(false);
  const refresh = useAuthStore((s) => s.refresh);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-n-50">
        <div className="text-[11.5px] font-mono text-n-500 tracking-[0.4px]">
          CSMP · loading…
        </div>
      </div>
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

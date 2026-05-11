import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card } from '../../components/hifi/Card';
import { Pill } from '../../components/hifi/Pill';
import { api } from '../../lib/api';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';
const APP_PHASE = 'PHASE 1.4';
const RAW_GIT_SHA = import.meta.env.VITE_GIT_SHA as string | undefined;
const GIT_SHA = RAW_GIT_SHA && RAW_GIT_SHA !== 'unknown' ? RAW_GIT_SHA : null;

export function AboutPage() {
  const [health, setHealth] = useState<'unknown' | 'ok' | 'down'>('unknown');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await api.get('healthz', { timeout: 5000 }).json();
        if (!cancelled) setHealth('ok');
      } catch {
        if (!cancelled) setHealth('down');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-2xl">
      <h2 className="text-[16px] font-semibold text-n-900">About</h2>
      <p className="text-[12.5px] text-n-600 mt-1 mb-4">Build and runtime details.</p>

      <Card className="p-5 space-y-3">
        <Row label="Application">
          <span className="text-[12.5px] text-n-800">CSMP Risk Manager</span>
        </Row>
        <Row label="Version">
          <span className="text-[12.5px] font-mono text-n-800">{APP_VERSION} · {APP_PHASE}</span>
        </Row>
        {GIT_SHA && (
          <Row label="Git SHA">
            <span className="text-[12.5px] font-mono text-n-800">{GIT_SHA}</span>
          </Row>
        )}
        <Row label="API status">
          {health === 'unknown' && <Pill>checking…</Pill>}
          {health === 'ok' && <Pill variant="ok">healthy</Pill>}
          {health === 'down' && <Pill variant="bad">unreachable</Pill>}
        </Row>
        <Row label="API documentation">
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[12px] text-a-700 hover:underline"
          >
            Swagger UI <ExternalLink className="w-3 h-3" />
          </a>
        </Row>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 items-center">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{label}</div>
      <div>{children}</div>
    </div>
  );
}

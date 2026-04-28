import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Layers, X, ExternalLink } from 'lucide-react';
import type { ClusterSummary } from '../../lib/csmp-types';

interface Props {
  cluster: ClusterSummary;
  onDismiss: () => void;
  durationMs?: number;
}

export function ClusterCreatedToast({ cluster, onDismiss, durationMs = 6000 }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-50 w-[320px] max-w-[92vw] bg-white border border-n-200 rounded-r2 shadow-sh3 px-3 py-2.5 flex items-start gap-2.5 csmp-no-export"
    >
      <div className="w-7 h-7 rounded-r1 bg-a-50 grid place-items-center shrink-0">
        <Layers className="w-3.5 h-3.5 text-a-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-n-900">Cluster created</div>
        <div className="text-[11.5px] text-n-600 truncate" title={cluster.name}>
          {cluster.name}
        </div>
        <Link
          to="/clusters"
          onClick={onDismiss}
          className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-a-700 hover:text-a-800 font-medium"
        >
          View in Clusters
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="w-5 h-5 flex items-center justify-center text-n-400 hover:text-n-700 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ProtectiveCoverageItem } from '../../../lib/csmp-types';
import { Card } from '../../hifi/Card';
import { CardHeader } from '../../hifi/CardHeader';
import { Pill } from '../../hifi/Pill';

interface ProtectiveCoverageProps {
  items: ProtectiveCoverageItem[];
}

function formatType(t: string): string {
  return t.toLowerCase().replace(/_/g, ' ');
}

function formatDegradedSince(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString();
}

export function ProtectiveCoverage({ items }: ProtectiveCoverageProps) {
  const edgeCount = items.filter((i) => i.source === 'EDGE').length;
  const implicitCount = items.length - edgeCount;

  return (
    <Card>
      <CardHeader
        title="Protective coverage"
        subtitle={items.length > 0
          ? `${items.length} protective asset${items.length === 1 ? '' : 's'} linked${
              implicitCount > 0 ? ` · ${edgeCount} edge, ${implicitCount} implicit` : ''
            }`
          : 'No protective assets linked'}
      />
      <div className="px-[14px] py-3">
        {items.length === 0 ? (
          <div className="text-[12px] text-n-500">
            No PROTECTS / MONITORS edges to this asset, and no PROTECTIVE / DUAL assets in
            its location subtree. Add coverage in the relationships graph.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((it) => {
              const degraded = it.operationalStatus !== 'OPERATIONAL';
              const degradedSince = formatDegradedSince(it.degradedSince);
              return (
                <li
                  key={it.protectiveAssetId}
                  className="flex items-start gap-2 border border-n-150 rounded-r2 px-2.5 py-1.5"
                >
                  {degraded ? (
                    <ShieldAlert className="w-4 h-4 text-bad flex-shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-n-900 truncate">
                      {it.name}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-n-500">
                      <span>
                        <span className="uppercase font-mono tracking-[0.4px]">Type:</span>{' '}
                        {formatType(it.assetType)}
                      </span>
                      <span>
                        <span className="uppercase font-mono tracking-[0.4px]">Crit:</span>{' '}
                        {it.criticality}
                      </span>
                      {degraded && (
                        <span className="text-bad">
                          {it.operationalStatus.toLowerCase()}
                          {degradedSince ? ` since ${degradedSince}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {it.source === 'EDGE' ? (
                      <Pill variant="accent">{it.relationshipType ?? 'EDGE'}</Pill>
                    ) : (
                      <Pill variant="default">implicit</Pill>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

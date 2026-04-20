import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { ClusterFormDrawer } from '../components/ClusterFormDrawer';
import { clustersApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { criticalityToRiskLevel, type ClusterSummary } from '../lib/csmp-types';

type Drawer =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; id: string };

export function ClustersPage() {
  const [items, setItems] = useState<ClusterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>({ kind: 'none' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clustersApi.list();
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(c: ClusterSummary) {
    if (!window.confirm(`Delete cluster "${c.name}"? Member assets will be preserved.`)) return;
    try {
      await clustersApi.remove(c.id);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  function handleSaved() {
    setDrawer({ kind: 'none' });
    void load();
  }

  return (
    <>
      <Topbar
        breadcrumbs={<span>Catalog / Clusters</span>}
        title="Asset clusters"
        subtitle={`${total} total · grouped criticality + propagation`}
        actions={
          <Btn2
            variant="primary"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setDrawer({ kind: 'create' })}
          >
            New cluster
          </Btn2>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-medium text-n-800 mb-1">No clusters yet</div>
            <div className="text-[12px] text-n-500 mb-4">
              Group related assets to derive joint criticality and propagate status changes.
            </div>
            <Btn2
              variant="primary"
              leading={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setDrawer({ kind: 'create' })}
            >
              Create your first cluster
            </Btn2>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((c) => (
              <div key={c.id} className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-n-900 truncate">{c.name}</div>
                    {c.description && (
                      <div className="text-[11.5px] text-n-600 mt-1 line-clamp-2">{c.description}</div>
                    )}
                  </div>
                  {c.derivedCriticality != null && (
                    <RiskBadge
                      level={criticalityToRiskLevel(c.derivedCriticality)}
                      value={c.derivedCriticality}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <Pill variant="accent">{c.clusterType}</Pill>
                  <Pill variant="outline">crit · {c.criticalityMode}</Pill>
                  <Pill variant="outline">prop · {c.statusPropagation}</Pill>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-n-100 -mx-4 -mb-4 px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11.5px] text-n-600">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-mono">{c.memberCount}</span>
                    <span>member{c.memberCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDrawer({ kind: 'edit', id: c.id })}
                      className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 hover:text-n-800 rounded-r1"
                      aria-label={`Edit ${c.name}`}
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                      aria-label={`Delete ${c.name}`}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {drawer.kind === 'create' && (
        <ClusterFormDrawer
          mode={{ kind: 'create' }}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={handleSaved}
        />
      )}
      {drawer.kind === 'edit' && (
        <ClusterFormDrawer
          mode={{ kind: 'edit', id: drawer.id }}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

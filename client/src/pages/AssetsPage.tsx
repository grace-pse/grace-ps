import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Plus, Search, Pencil, Trash2, Copy, X, MapPin, ShieldAlert } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { AssetFormDrawer } from '../components/AssetFormDrawer';
import { assetsApi, type AssetListParams } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { assetsRoute } from '../routes/router';
import {
  ASSET_TYPES,
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_ROLES,
  ASSET_ROLE_LABEL,
  OPERATIONAL_STATUSES,
  OPERATIONAL_STATUS_LABEL,
  criticalityToRiskLevel,
  type AssetSummary,
  type AssetType,
  type AssetCategory,
  type AssetStatus,
  type AssetRole,
  type OperationalStatus,
  type AssetGraphNode,
} from '../lib/csmp-types';

type Drawer =
  | { kind: 'none' }
  // parentId pre-fills the Parent dropdown (used when adding a child
  // from inside another asset's edit drawer). history works like in
  // edit — when non-empty, save returns to the previous drawer instead
  // of closing. Template selection happens inside AssetFormDrawer itself.
  | {
      kind: 'create';
      parentId?: string;
      history?: string[];
    }
  // history is the chain of asset ids the user drilled through to reach
  // this one (oldest first). When non-empty, the drawer shows a Back
  // button and Save keeps the drawer open instead of closing.
  | { kind: 'edit'; id: string; history: string[] };

const PAGE_SIZE = 50;

const STATUS_VARIANT: Record<AssetStatus, 'ok' | 'warn' | 'bad' | 'default'> = {
  ACTIVE: 'ok',
  UNDER_REVIEW: 'warn',
  COMPROMISED: 'bad',
  DECOMMISSIONED: 'default',
};

const ROLE_VARIANT: Record<AssetRole, 'default' | 'accent' | 'outline'> = {
  PROTECTED: 'default',
  PROTECTIVE: 'accent',
  DUAL: 'outline',
};

const OP_STATUS_VARIANT: Record<OperationalStatus, 'ok' | 'warn' | 'bad' | 'default'> = {
  OPERATIONAL: 'ok',
  DEGRADED: 'warn',
  FAILED: 'bad',
  UNKNOWN: 'default',
};

export function AssetsPage() {
  const navigate = useNavigate();
  const { siteId } = assetsRoute.useSearch();

  const [items, setItems] = useState<AssetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>({ kind: 'none' });
  // Tenant-wide name lookup so the Parent column can resolve parents
  // that aren't on the currently visible page (or aren't in items at all
  // due to filters).
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());

  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState<AssetType | ''>('');
  const [category, setCategory] = useState<AssetCategory | ''>('');
  const [status, setStatus] = useState<AssetStatus | ''>('');
  const [assetRole, setAssetRole] = useState<AssetRole | ''>('');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus | ''>('');
  const [degradedCount, setDegradedCount] = useState(0);

  // When a siteId is pinned (via ?siteId=... from the Site Map), we scope
  // the listing to that asset + all its descendants via a client-side filter
  // over the asset tree. The API only supports direct-parent filtering, so
  // we walk the graph to collect the descendant set.
  const [siteScope, setSiteScope] = useState<{
    name: string;
    ids: Set<string>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!siteId) { setSiteScope(null); return; }
    void (async () => {
      try {
        const [site, graph] = await Promise.all([
          assetsApi.get(siteId),
          assetsApi.graph(),
        ]);
        const byParent = new Map<string | null, AssetGraphNode[]>();
        for (const n of graph.nodes) {
          const arr = byParent.get(n.parentId) ?? [];
          arr.push(n);
          byParent.set(n.parentId, arr);
        }
        const ids = new Set<string>([siteId]);
        const stack = [siteId];
        while (stack.length) {
          const next = stack.pop()!;
          for (const child of byParent.get(next) ?? []) {
            if (!ids.has(child.id)) {
              ids.add(child.id);
              stack.push(child.id);
            }
          }
        }
        if (!cancelled) setSiteScope({ name: site.name, ids });
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      }
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  function clearSiteScope() {
    void navigate({ to: '/assets', search: {} });
  }

  // The search box doubles as MQTT-style path query: anything containing
  // '/', '+', or '#' is sent as `path`; bare text continues to hit name/
  // description full-text via `search`.
  const isPathQuery = /[\/+#]/.test(search);

  const params = useMemo<AssetListParams>(
    () => ({
      search: !isPathQuery && search ? search : undefined,
      path: isPathQuery && search ? search : undefined,
      assetType: (assetType || undefined) as AssetType | undefined,
      category: (category || undefined) as AssetCategory | undefined,
      status: (status || undefined) as AssetStatus | undefined,
      assetRole: (assetRole || undefined) as AssetRole | undefined,
      operationalStatus: (operationalStatus || undefined) as OperationalStatus | undefined,
      page,
      // When scoped to a site, request the server's max so the client-side
      // ID filter below doesn't strand pages of unrelated assets. The
      // /assets route caps pageSize at 200 — plenty for any realistic site
      // drill-in (Nordica's largest has 10 descendants).
      pageSize: siteScope ? 200 : PAGE_SIZE,
    }),
    [search, isPathQuery, assetType, category, status, assetRole, operationalStatus, page, siteScope],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await assetsApi.list(params);
      if (siteScope) {
        const filtered = res.items.filter((a) => siteScope.ids.has(a.id));
        setItems(filtered);
        setTotal(filtered.length);
      } else {
        setItems(res.items);
        setTotal(res.total);
      }
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [params, siteScope]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => { setPage(1); }, [search, assetType, category, status, assetRole, operationalStatus, siteScope]);

  // Polls the count of assets currently flagged with degraded protective
  // posture. Cheap (indexed boolean filter, page=1, pageSize=1) and refreshes
  // alongside the main list so toggling a CCTV's status updates the banner.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await assetsApi.list({ degradedControlPosture: true, page: 1, pageSize: 1 });
        if (!cancelled) setDegradedCount(res.total);
      } catch {
        if (!cancelled) setDegradedCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [items]);

  // One-shot graph load — used to render parent names regardless of which
  // page the parent lives on. Refreshes whenever an edit/delete completes
  // so renames propagate to the column without a manual reload.
  const refreshGraph = useCallback(async () => {
    try {
      const g = await assetsApi.graph();
      setNameById(new Map(g.nodes.map((n) => [n.id, n.name])));
    } catch {
      // best-effort — Parent column will fall back to "—"
    }
  }, []);

  useEffect(() => { void refreshGraph(); }, [refreshGraph]);

  async function handleDelete(asset: AssetSummary) {
    if (!window.confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    try {
      await assetsApi.remove(asset.id);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleClone(asset: AssetSummary) {
    const raw = window.prompt(
      `Name for the cloned asset (deep-clones "${asset.name}" + descendants):`,
      `${asset.name} (copy)`,
    );
    if (raw === null) return;
    const name = raw.trim();
    if (!name) return;
    try {
      await assetsApi.clone(asset.id, { name });
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Topbar
        breadcrumbs={<span>Catalog / Assets</span>}
        title="Assets"
        subtitle={`${total} total · tangible + intangible`}
        actions={
          <Btn2
            variant="primary"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setDrawer({ kind: 'create' })}
          >
            New asset
          </Btn2>
        }
      />

      <div className="p-6 space-y-4">
        {degradedCount > 0 && (
          <button
            type="button"
            onClick={() => { setAssetRole(''); setOperationalStatus(''); setSearch(''); setAssetType(''); setCategory(''); setStatus(''); }}
            className="w-full text-left bg-warn-bg border border-warn/40 rounded-r3 shadow-sh1 px-3 py-2 flex items-center gap-2 text-[12.5px] text-warn-700 hover:bg-warn-bg/70"
            role="status"
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong className="font-semibold">{degradedCount}</strong> protected asset{degradedCount === 1 ? '' : 's'} show degraded posture — at least one PROTECTS / MONITORS link is non-OPERATIONAL.
            </span>
          </button>
        )}

        {siteScope && (
          <div className="bg-a-50 border border-a-200 rounded-r3 shadow-sh1 px-3 py-2 flex items-center gap-2 text-[12.5px] text-a-700">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              Showing assets at <strong className="font-semibold">{siteScope.name}</strong>{' '}
              <span className="text-a-600 font-mono text-[11px]">
                ({siteScope.ids.size - 1} descendant{siteScope.ids.size === 2 ? '' : 's'})
              </span>
            </span>
            <button
              type="button"
              onClick={clearSiteScope}
              className="ml-auto inline-flex items-center gap-1 text-a-700 hover:bg-a-100 rounded-r1 px-1.5 py-0.5"
              aria-label="Clear site filter"
            >
              <X className="w-3 h-3" />
              <span className="text-[11.5px]">Clear</span>
            </button>
          </div>
        )}

        <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-3 flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, tag, or path (site/+/room, site/#)…"
              className={`w-full h-8 pl-8 pr-2.5 text-[12.5px] border rounded-r2 focus:outline-none ${
                isPathQuery
                  ? 'border-a-500 font-mono bg-a-50/40'
                  : 'border-n-200 focus:border-a-500'
              }`}
            />
          </label>
          <FilterSelect
            value={assetType}
            onChange={(v) => setAssetType(v as AssetType | '')}
            placeholder="All types"
            options={ASSET_TYPES}
          />
          <FilterSelect
            value={category}
            onChange={(v) => setCategory(v as AssetCategory | '')}
            placeholder="All categories"
            options={ASSET_CATEGORIES}
          />
          <FilterSelect
            value={status}
            onChange={(v) => setStatus(v as AssetStatus | '')}
            placeholder="All statuses"
            options={ASSET_STATUSES}
          />
          <FilterSelect
            value={assetRole}
            onChange={(v) => setAssetRole(v as AssetRole | '')}
            placeholder="All roles"
            options={ASSET_ROLES}
            labelFor={(v) => ASSET_ROLE_LABEL[v as AssetRole]}
          />
          <FilterSelect
            value={operationalStatus}
            onChange={(v) => setOperationalStatus(v as OperationalStatus | '')}
            placeholder="All op statuses"
            options={OPERATIONAL_STATUSES}
            labelFor={(v) => OPERATIONAL_STATUS_LABEL[v as OperationalStatus]}
          />
          {(search || assetType || category || status || assetRole || operationalStatus) && (
            <Btn2
              variant="ghost"
              onClick={() => {
                setSearch(''); setAssetType(''); setCategory(''); setStatus('');
                setAssetRole(''); setOperationalStatus('');
              }}
            >
              Clear
            </Btn2>
          )}
        </div>

        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] border-b border-n-150 bg-n-50">
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-3 py-2.5 font-medium">Path</th>
                <th className="text-left px-3 py-2.5 font-medium">Type</th>
                <th className="text-left px-3 py-2.5 font-medium">Role</th>
                <th className="text-left px-3 py-2.5 font-medium">Criticality</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-3 py-2.5 font-medium">Tags</th>
                <th className="text-right px-3 py-2.5 font-medium">Children</th>
                <th className="text-right px-4 py-2.5 font-medium w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center px-4 py-10 text-[12.5px] text-n-500">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center px-4 py-10 text-[12.5px] text-n-500">
                    No assets yet. Use <span className="font-mono">New asset</span> to get started — pick a template from inside the drawer to pre-fill the form.
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id} className="border-b border-n-100 last:border-b-0 hover:bg-n-50">
                    <td className="px-4 py-2 text-[13px] text-n-900 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {a.degradedControlPosture && (
                          <span title="One or more linked protective assets are non-OPERATIONAL">
                            <ShieldAlert
                              className="w-3.5 h-3.5 text-warn-700 shrink-0"
                              aria-label="Degraded protective posture"
                            />
                          </span>
                        )}
                        <span>{a.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11.5px] font-mono">
                      {a.path ? (
                        <button
                          type="button"
                          onClick={() => a.parentId && setDrawer({ kind: 'edit', id: a.parentId, history: [] })}
                          disabled={!a.parentId}
                          className="text-n-700 hover:text-a-800 hover:underline disabled:no-underline disabled:cursor-default truncate max-w-[260px] inline-block align-middle text-left"
                          title={a.path}
                        >
                          {truncatePath(a.path)}
                        </button>
                      ) : (
                        <span className="text-n-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] font-mono text-n-700">{a.assetType}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <Pill variant={ROLE_VARIANT[a.assetRole]}>{ASSET_ROLE_LABEL[a.assetRole]}</Pill>
                        {(a.assetRole === 'PROTECTIVE' || a.assetRole === 'DUAL') && a.operationalStatus !== 'OPERATIONAL' && (
                          <Pill variant={OP_STATUS_VARIANT[a.operationalStatus]}>{OPERATIONAL_STATUS_LABEL[a.operationalStatus]}</Pill>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <RiskBadge level={criticalityToRiskLevel(a.criticality)} value={a.criticality} />
                    </td>
                    <td className="px-3 py-2">
                      <Pill variant={STATUS_VARIANT[a.status]}>{a.status}</Pill>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {a.tags.slice(0, 3).map((t) => (
                          <Pill key={t} variant="outline">{t}</Pill>
                        ))}
                        {a.tags.length > 3 && (
                          <span className="text-[10.5px] text-n-500">+{a.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-mono text-n-600">
                      {a.childCount > 0 ? a.childCount : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: 'edit', id: a.id, history: [] })}
                          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 hover:text-n-800 rounded-r1"
                          aria-label={`Edit ${a.name}`}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClone(a)}
                          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 hover:text-n-800 rounded-r1"
                          aria-label={`Clone ${a.name}`}
                          title="Clone (deep-copies the full subtree)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a)}
                          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                          aria-label={`Delete ${a.name}`}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-n-150 text-[11.5px] text-n-600">
              <span>Page {page} of {totalPages} · {total} results</span>
              <div className="flex items-center gap-1">
                <Btn2 variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Btn2>
                <Btn2 variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn2>
              </div>
            </div>
          )}
        </div>
      </div>

      {drawer.kind === 'create' && (() => {
        const createDrawer = drawer;
        const history = createDrawer.history ?? [];
        const prevId = history[history.length - 1];
        const prevName = prevId ? nameById.get(prevId) ?? null : null;
        return (
          <AssetFormDrawer
            key={`create-${createDrawer.parentId ?? 'root'}-${history.length}`}
            mode={{
              kind: 'create',
              parentId: createDrawer.parentId,
            }}
            onClose={() => setDrawer({ kind: 'none' })}
            onSaved={() => {
              void load();
              void refreshGraph();
              // If the create drawer was launched from inside a parent
              // edit (Add child flow), bounce back to that edit drawer
              // so the user sees the freshly added child in the list.
              if (prevId) {
                setDrawer({
                  kind: 'edit',
                  id: prevId,
                  history: history.slice(0, -1),
                });
              } else {
                setDrawer({ kind: 'none' });
              }
            }}
            onBack={prevId ? () => setDrawer({
              kind: 'edit',
              id: prevId,
              history: history.slice(0, -1),
            }) : undefined}
            backLabel={prevName ?? undefined}
            availableParents={items}
          />
        );
      })()}
      {drawer.kind === 'edit' && (() => {
        const editDrawer = drawer; // narrow for closures
        const prevId = editDrawer.history[editDrawer.history.length - 1];
        const prevName = prevId ? nameById.get(prevId) ?? null : null;
        return (
          <AssetFormDrawer
            key={editDrawer.id}
            mode={{ kind: 'edit', id: editDrawer.id }}
            onClose={() => setDrawer({ kind: 'none' })}
            onSaved={() => {
              void load();
              void refreshGraph();
              // When the user drilled into a child, keep the drawer open
              // so they can keep working without losing the navigation
              // chain. Top-level edits still close on save (existing UX).
              if (editDrawer.history.length === 0) {
                setDrawer({ kind: 'none' });
              }
            }}
            onEditAsset={(id) => setDrawer({
              kind: 'edit',
              id,
              history: [...editDrawer.history, editDrawer.id],
            })}
            onAddChild={() => setDrawer({
              kind: 'create',
              parentId: editDrawer.id,
              history: [...editDrawer.history, editDrawer.id],
            })}
            onBack={prevId ? () => setDrawer({
              kind: 'edit',
              id: prevId,
              history: editDrawer.history.slice(0, -1),
            }) : undefined}
            backLabel={prevName ?? undefined}
            availableParents={items}
          />
        );
      })()}
    </>
  );
}

function FilterSelect<T extends string>({
  value, onChange, placeholder, options, labelFor,
}: {
  value: T | '';
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly T[];
  labelFor?: (v: T) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{labelFor ? labelFor(o) : o}</option>)}
    </select>
  );
}

// Show the last 3 segments of a path, prefixed with `…/` when deeper.
// Keeps the asset's own segment + its immediate ancestors visible at small
// column widths; the full path is on the title attribute for hover.
function truncatePath(path: string): string {
  const segs = path.split('/');
  if (segs.length <= 3) return path;
  return `…/${segs.slice(-3).join('/')}`;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Plus, Search, Pencil, Trash2, Copy, PackagePlus, X, MapPin } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { AssetFormDrawer } from '../components/AssetFormDrawer';
import { TemplatePickerDrawer } from '../components/TemplatePickerDrawer';
import { assetsApi, type AssetListParams } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { assetsRoute } from '../routes/router';
import {
  ASSET_TYPES,
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  criticalityToRiskLevel,
  type AssetSummary,
  type AssetType,
  type AssetCategory,
  type AssetStatus,
  type AssetTemplateSummary,
  type AssetGraphNode,
} from '../lib/csmp-types';

type Drawer =
  | { kind: 'none' }
  // parentId pre-fills the Parent dropdown (used when adding a child
  // from inside another asset's edit drawer). history works like in
  // edit — when non-empty, save returns to the previous drawer instead
  // of closing.
  | {
      kind: 'create';
      template?: { id: string; name: string };
      parentId?: string;
      history?: string[];
    }
  // history is the chain of asset ids the user drilled through to reach
  // this one (oldest first). When non-empty, the drawer shows a Back
  // button and Save keeps the drawer open instead of closing.
  | { kind: 'edit'; id: string; history: string[] }
  | { kind: 'template-picker' };

const PAGE_SIZE = 50;

const STATUS_VARIANT: Record<AssetStatus, 'ok' | 'warn' | 'bad' | 'default'> = {
  ACTIVE: 'ok',
  UNDER_REVIEW: 'warn',
  COMPROMISED: 'bad',
  DECOMMISSIONED: 'default',
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

  const params = useMemo<AssetListParams>(
    () => ({
      search: search || undefined,
      assetType: (assetType || undefined) as AssetType | undefined,
      category: (category || undefined) as AssetCategory | undefined,
      status: (status || undefined) as AssetStatus | undefined,
      page,
      // When scoped to a site, request the server's max so the client-side
      // ID filter below doesn't strand pages of unrelated assets. The
      // /assets route caps pageSize at 200 — plenty for any realistic site
      // drill-in (Nordica's largest has 10 descendants).
      pageSize: siteScope ? 200 : PAGE_SIZE,
    }),
    [search, assetType, category, status, page, siteScope],
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

  useEffect(() => { setPage(1); }, [search, assetType, category, status, siteScope]);

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
          <>
            <Btn2
              variant="secondary"
              leading={<PackagePlus className="w-3.5 h-3.5" />}
              onClick={() => setDrawer({ kind: 'template-picker' })}
            >
              From template
            </Btn2>
            <Btn2
              variant="primary"
              leading={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setDrawer({ kind: 'create' })}
            >
              New asset
            </Btn2>
          </>
        }
      />

      <div className="p-6 space-y-4">
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
              placeholder="Search by name, description, or tag…"
              className="w-full h-8 pl-8 pr-2.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
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
          {(search || assetType || category || status) && (
            <Btn2
              variant="ghost"
              onClick={() => { setSearch(''); setAssetType(''); setCategory(''); setStatus(''); }}
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
                <th className="text-left px-3 py-2.5 font-medium">Parent</th>
                <th className="text-left px-3 py-2.5 font-medium">Type</th>
                <th className="text-left px-3 py-2.5 font-medium">Category</th>
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
                    No assets yet. Use <span className="font-mono">New asset</span> or{' '}
                    <span className="font-mono">From template</span> to get started.
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id} className="border-b border-n-100 last:border-b-0 hover:bg-n-50">
                    <td className="px-4 py-2 text-[13px] text-n-900 font-medium">{a.name}</td>
                    <td className="px-3 py-2 text-[12px]">
                      {a.parentId ? (
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: 'edit', id: a.parentId!, history: [] })}
                          className="text-a-700 hover:text-a-800 hover:underline truncate max-w-[180px] inline-block align-middle"
                          title={`Edit ${nameById.get(a.parentId) ?? a.parentId}`}
                        >
                          {nameById.get(a.parentId) ?? '—'}
                        </button>
                      ) : (
                        <span className="text-n-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] font-mono text-n-700">{a.assetType}</td>
                    <td className="px-3 py-2 text-[11.5px] text-n-600">{a.category}</td>
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
              template: createDrawer.template,
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
      {drawer.kind === 'template-picker' && (
        <TemplatePickerDrawer
          onClose={() => setDrawer({ kind: 'none' })}
          onPick={(tpl: AssetTemplateSummary) =>
            setDrawer({ kind: 'create', template: { id: tpl.id, name: tpl.name } })
          }
        />
      )}
    </>
  );
}

function FilterSelect<T extends string>({
  value, onChange, placeholder, options,
}: {
  value: T | '';
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly T[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

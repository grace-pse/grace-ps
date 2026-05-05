import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, ChevronDown, Search, X, Shield, ShieldCheck, ShieldHalf,
  AlertTriangle, ChevronsDown, ChevronsRight, GitBranch,
} from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Pill } from '../components/hifi/Pill';
import { Btn2 } from '../components/hifi/Btn2';
import { assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  ASSET_TYPES, ASSET_ROLES, ASSET_ROLE_LABEL,
  criticalityToRiskLevel,
  type AssetTreeNode, type AssetType, type AssetRole, type AssetTreeCoverageStatus,
} from '../lib/csmp-types';
import { useAppearanceStore } from '../stores/appearance';
import {
  resolveIcon, getShapeRadiusClass,
} from '../lib/appearance-defaults';
import { useAssetSelectionStore } from '../stores/assetSelection';
import { AssetDetailDrawer } from '../components/AssetDetailDrawer';

// Indented tree view of the asset catalog. Complementary to the graph at
// /relationships — when you just want to scan "what's inside Żaryna 2a?"
// this beats any node-link layout for clarity at scale.
//
// Phase 1: simple recursive renderer (no virtualisation). At ~100 assets the
// DOM cost is fine; we'll add @tanstack/react-virtual when tenants approach
// ~500 assets.

const COLLAPSE_KEY = 'csmp.assets.tree.collapsed';

interface FilterState {
  search: string;
  type: AssetType | '';
  role: AssetRole | '';
  coverage: AssetTreeCoverageStatus | '';
}

const DEFAULT_FILTERS: FilterState = {
  search: '', type: '', role: '', coverage: '',
};

export function AssetsTreePage() {
  const [items, setItems] = useState<AssetTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const open = useAssetSelectionStore((s) => s.open);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const res = await assetsApi.tree();
        if (cancelled) return;
        setItems(res.items);
      } catch (err) {
        if (cancelled) return;
        setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);

  // Derive children-by-parent and roots once. The flat list comes back
  // sorted by name; we'll keep that order for siblings.
  const { rootIds, childrenById, nodeById } = useMemo(() => {
    const childrenById = new Map<string, AssetTreeNode[]>();
    const nodeById = new Map<string, AssetTreeNode>();
    const rootIds: string[] = [];
    for (const n of items) nodeById.set(n.id, n);
    for (const n of items) {
      if (n.parentId) {
        const arr = childrenById.get(n.parentId);
        if (arr) arr.push(n);
        else childrenById.set(n.parentId, [n]);
      } else {
        rootIds.push(n.id);
      }
    }
    return { rootIds, childrenById, nodeById };
  }, [items]);

  // Apply filters and compute the set of nodes to render. A node is shown
  // if it (or any descendant) matches; we expand ancestors so matches stay
  // visible even when their parents are collapsed.
  const { visibleIds, forceExpanded, matchCount } = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const hasFilter = term || filters.type || filters.role || filters.coverage;

    // No filter active — every node is visible, nothing force-expanded.
    // (Returning a non-empty forceExpanded here was the collapse bug: when
    // match() returns true for everything, every parent ends up in
    // forceExpanded, permanently blocking collapse.)
    if (!hasFilter) {
      const visible = new Set(items.map((n) => n.id));
      return { visibleIds: visible, forceExpanded: new Set<string>(), matchCount: 0 };
    }

    const match = (n: AssetTreeNode) => {
      if (term && !n.name.toLowerCase().includes(term)) return false;
      if (filters.type && n.assetType !== filters.type) return false;
      if (filters.role && n.assetRole !== filters.role) return false;
      if (filters.coverage && n.coverageStatus !== filters.coverage) return false;
      return true;
    };

    const matches = new Set<string>();
    for (const n of items) if (match(n)) matches.add(n.id);

    // Walk up: any ancestor of a match is also visible and force-expanded so
    // the matching descendant stays visible even if the ancestor was collapsed.
    const visible = new Set<string>(matches);
    const forceExpanded = new Set<string>();
    for (const id of matches) {
      let cur = nodeById.get(id)?.parentId ?? null;
      while (cur) {
        visible.add(cur);
        forceExpanded.add(cur);
        cur = nodeById.get(cur)?.parentId ?? null;
      }
    }
    return { visibleIds: visible, forceExpanded, matchCount: matches.size };
  }, [items, filters, nodeById]);

  const filtersActive =
    filters.search.trim() !== '' ||
    filters.type !== '' ||
    filters.role !== '' ||
    filters.coverage !== '';

  function expandAll() {
    setCollapsed(new Set());
  }
  function collapseAll() {
    const all = new Set<string>();
    for (const n of items) {
      if ((childrenById.get(n.id)?.length ?? 0) > 0) all.add(n.id);
    }
    setCollapsed(all);
  }
  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const subtitle = useMemo(() => {
    const parts = [`${items.length} assets`];
    const sites = items.filter((n) => n.assetType === 'SITE').length;
    if (sites > 0) parts.push(`${sites} site${sites === 1 ? '' : 's'}`);
    if (filtersActive) parts.push(`${matchCount} match${matchCount === 1 ? '' : 'es'}`);
    return parts.join(' · ');
  }, [items, filtersActive, matchCount]);

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Asset tree"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Filter by name…"
                className="text-[11.5px] h-7 pl-6 pr-6 border border-n-200 rounded-r1 bg-white w-44 focus:outline-none focus:ring-1 focus:ring-a-500"
              />
              {filters.search && (
                <button
                  type="button"
                  aria-label="Clear name filter"
                  onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 grid place-items-center text-n-500 hover:text-n-800"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as AssetType | '' }))}
              className="text-[11.5px] h-7 px-2 border border-n-200 rounded-r1 bg-white"
            >
              <option value="">All types</option>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={filters.role}
              onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value as AssetRole | '' }))}
              className="text-[11.5px] h-7 px-2 border border-n-200 rounded-r1 bg-white"
            >
              <option value="">All roles</option>
              {ASSET_ROLES.map((r) => <option key={r} value={r}>{ASSET_ROLE_LABEL[r]}</option>)}
            </select>
            <select
              value={filters.coverage}
              onChange={(e) => setFilters((f) => ({ ...f, coverage: e.target.value as AssetTreeCoverageStatus | '' }))}
              className="text-[11.5px] h-7 px-2 border border-n-200 rounded-r1 bg-white"
              title="Filter by protective coverage status"
            >
              <option value="">Any coverage</option>
              <option value="covered">Covered</option>
              <option value="uncovered">Uncovered</option>
              <option value="na">N/A (protective)</option>
            </select>
            <Btn2 variant="ghost" leading={<ChevronsDown size={12} />} onClick={expandAll}>
              Expand all
            </Btn2>
            <Btn2 variant="ghost" leading={<ChevronsRight size={12} />} onClick={collapseAll}>
              Collapse
            </Btn2>
            {filtersActive && (
              <Btn2 variant="ghost" onClick={clearFilters}>Clear filters</Btn2>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto bg-n-50">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border-b border-bad/20 px-4 py-2">{error}</div>
        )}
        {loading ? (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-[12.5px] text-n-500">
            No assets yet. Add your first asset under <a className="text-a-700 hover:underline" href="/assets">Catalog → Assets</a>.
          </div>
        ) : (
          <ul className="px-3 py-2">
            {rootIds.map((id) => (
              <TreeRow
                key={id}
                nodeId={id}
                depth={0}
                visibleIds={visibleIds}
                forceExpanded={forceExpanded}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                childrenById={childrenById}
                nodeById={nodeById}
                onSelect={open}
              />
            ))}
          </ul>
        )}
      </div>

      <AssetDetailDrawer />
    </div>
  );
}

interface TreeRowProps {
  nodeId: string;
  depth: number;
  visibleIds: Set<string>;
  forceExpanded: Set<string>;
  collapsed: Set<string>;
  setCollapsed: React.Dispatch<React.SetStateAction<Set<string>>>;
  childrenById: Map<string, AssetTreeNode[]>;
  nodeById: Map<string, AssetTreeNode>;
  onSelect: (id: string) => void;
}

function TreeRow({
  nodeId, depth, visibleIds, forceExpanded, collapsed, setCollapsed,
  childrenById, nodeById, onSelect,
}: TreeRowProps) {
  const node = nodeById.get(nodeId);
  if (!node) return null;
  if (!visibleIds.has(node.id)) return null;

  const kids = (childrenById.get(node.id) ?? []).filter((c) => visibleIds.has(c.id));
  const hasKids = kids.length > 0;
  const isCollapsed = collapsed.has(node.id) && !forceExpanded.has(node.id);

  function toggle() {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(node!.id)) next.delete(node!.id);
      else next.add(node!.id);
      return next;
    });
  }

  return (
    <li>
      <Row
        node={node}
        depth={depth}
        hasKids={hasKids}
        collapsed={isCollapsed}
        onToggle={toggle}
        onSelect={() => onSelect(node.id)}
      />
      {hasKids && !isCollapsed && (
        <ul>
          {kids.map((c) => (
            <TreeRow
              key={c.id}
              nodeId={c.id}
              depth={depth + 1}
              visibleIds={visibleIds}
              forceExpanded={forceExpanded}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              childrenById={childrenById}
              nodeById={nodeById}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Row({
  node, depth, hasKids, collapsed, onToggle, onSelect,
}: {
  node: AssetTreeNode;
  depth: number;
  hasKids: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const appearance = useAppearanceStore((s) => s.appearance);
  const t = appearance.assetTypeStyles[node.assetType];
  const TypeIcon = resolveIcon(t.iconName);
  const shape = getShapeRadiusClass(node.assetType);
  const level = criticalityToRiskLevel(node.criticality);
  return (
    <div
      className="group flex items-center gap-2 h-7 pr-2 rounded-r1 hover:bg-white/70"
      style={{ paddingLeft: 8 + depth * 18 }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand' : 'Collapse'}
        className={[
          'w-4 h-4 grid place-items-center text-n-500 hover:text-n-900 shrink-0',
          hasKids ? '' : 'invisible',
        ].join(' ')}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-2 min-w-0 flex-1 text-left"
      >
        <span
          className={`inline-flex items-center justify-center w-5 h-5 shrink-0 ${shape}`}
          style={{ backgroundColor: t.bg, color: t.ink }}
          title={t.abbr}
        >
          <TypeIcon size={11} />
        </span>
        <span className="text-[12.5px] text-n-900 truncate group-hover:text-a-800" title={node.name}>
          {node.name}
        </span>
        {hasKids && (
          <span className="text-[10px] font-mono text-n-400 tracking-[0.4px] shrink-0">
            {node.childCount}
          </span>
        )}
      </button>
      <RoleChip role={node.assetRole} />
      <CoverageBadge status={node.coverageStatus} />
      <span
        className={[
          'text-[10px] font-mono px-1 py-px rounded-r1 shrink-0',
          level === 'Extreme' || level === 'High' ? 'text-bad bg-bad-bg' :
          level === 'Moderate' ? 'text-warn bg-warn-bg' :
          'text-n-500 bg-n-100',
        ].join(' ')}
        title={`Criticality C${node.criticality} (${level})`}
      >
        C{node.criticality}
      </span>
      {(node.inDegree + node.outDegree > 0) && (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-mono text-n-500 shrink-0"
          title={`${node.inDegree} in / ${node.outDegree} out`}
        >
          <GitBranch size={10} />
          {node.inDegree + node.outDegree}
        </span>
      )}
    </div>
  );
}

function RoleChip({ role }: { role: AssetRole }) {
  if (role === 'PROTECTED') {
    return (
      <Pill variant="default" icon={<Shield />}>{ASSET_ROLE_LABEL[role]}</Pill>
    );
  }
  if (role === 'PROTECTIVE') {
    return (
      <Pill variant="accent" icon={<ShieldCheck />}>{ASSET_ROLE_LABEL[role]}</Pill>
    );
  }
  return (
    <Pill variant="info" icon={<ShieldHalf />}>{ASSET_ROLE_LABEL[role]}</Pill>
  );
}

function CoverageBadge({ status }: { status: AssetTreeCoverageStatus }) {
  if (status === 'covered') {
    return <Pill variant="ok" icon={<ShieldCheck />}>covered</Pill>;
  }
  if (status === 'uncovered') {
    return <Pill variant="warn" icon={<AlertTriangle />}>uncovered</Pill>;
  }
  return null; // 'na' — no badge keeps the row quiet for protective assets
}

// ─── persistence ───────────────────────────────────────────

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsed(ids: Set<string>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

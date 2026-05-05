import { useEffect, useMemo, useState } from 'react';
import {
  Search, X, AlertTriangle, ShieldCheck, Eye, Truck, Server, ArrowRightLeft,
  Network, MapPin, Box, Shield, Filter,
} from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Pill } from '../components/hifi/Pill';
import { Btn2 } from '../components/hifi/Btn2';
import { RelationshipsTabBar } from '../components/relationships/RelationshipsTabBar';
import { assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  RELATIONSHIP_TYPE_LABEL, RELATIONSHIP_TYPES,
  type AssetGraphResponse, type AssetGraphNode,
  type AssetRelationshipSummary, type RelationshipType,
} from '../lib/csmp-types';
import { useAppearanceStore } from '../stores/appearance';
import { resolveIcon } from '../lib/appearance-defaults';
import { useAssetSelectionStore } from '../stores/assetSelection';

// Coverage matrix — rows are PROTECTIVE/DUAL assets (the ones doing the
// covering), columns are PROTECTED/DUAL assets (the ones being covered).
// Cells fill in when a relationship edge exists between them. The point of
// this lens is to spot uncovered protected assets at a glance: they show
// up as empty columns. Orphan protective assets (covering nothing) are
// empty rows.
//
// Both views share the same /api/assets/graph endpoint as the node-link
// diagram — we just shape it differently. The matrix page is intentionally
// simpler than the graph: no nesting, no manual layout, no isolate. Click
// a row/column/cell to drill into the asset detail drawer.

const RELATIONSHIP_ICON: Record<RelationshipType, React.ComponentType<{ size?: number; className?: string }>> = {
  PROTECTS: Shield,
  MONITORS: Eye,
  SUPPLIES: Truck,
  SERVES: Server,
  DEPENDS_ON: ArrowRightLeft,
  COMMUNICATES_WITH: Network,
  ADJACENT_TO: MapPin,
  CONTAINS: Box,
};

interface FilterState {
  search: string;
  type: RelationshipType | '';
  onlyUncovered: boolean;
  onlyOrphans: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  search: '', type: '', onlyUncovered: false, onlyOrphans: false,
};

export function CoverageMatrixPage() {
  const [graph, setGraph] = useState<AssetGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const open = useAssetSelectionStore((s) => s.open);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const g = await assetsApi.graph();
        if (cancelled) return;
        setGraph(g);
      } catch (err) {
        if (cancelled) return;
        setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const {
    rows, cols, cellMap, rowCovers, colCoveredBy,
    totalProtective, totalProtected, uncoveredCount, orphanCount, edgeCount,
  } = useMemo(() => {
    const empty = {
      rows: [] as AssetGraphNode[],
      cols: [] as AssetGraphNode[],
      cellMap: new Map<string, AssetRelationshipSummary[]>(),
      rowCovers: new Map<string, number>(),
      colCoveredBy: new Map<string, number>(),
      totalProtective: 0, totalProtected: 0, uncoveredCount: 0, orphanCount: 0, edgeCount: 0,
    };
    if (!graph) return empty;

    // Pools (DUAL appears in both — it's both source and target candidate).
    const protectivePool = graph.nodes.filter(
      (n) => n.assetRole === 'PROTECTIVE' || n.assetRole === 'DUAL',
    );
    const protectedPool = graph.nodes.filter(
      (n) => n.assetRole === 'PROTECTED' || n.assetRole === 'DUAL',
    );

    // Build the cell index. Filter by relationship type if requested.
    // Bidirectional edges show up as cells in both directions.
    const cellMap = new Map<string, AssetRelationshipSummary[]>();
    let edgeCount = 0;
    for (const e of graph.edges) {
      if (filters.type && e.relationshipType !== filters.type) continue;
      edgeCount++;
      const key = `${e.sourceAssetId}|${e.targetAssetId}`;
      const arr = cellMap.get(key);
      if (arr) arr.push(e);
      else cellMap.set(key, [e]);
      if (e.direction === 'BIDIRECTIONAL') {
        const rev = `${e.targetAssetId}|${e.sourceAssetId}`;
        const arr2 = cellMap.get(rev);
        if (arr2) arr2.push(e);
        else cellMap.set(rev, [e]);
      }
    }

    // For each protective row: count how many protected columns it covers.
    // For each protected column: count how many protective rows cover it.
    const rowCovers = new Map<string, number>();
    const colCoveredBy = new Map<string, number>();
    for (const r of protectivePool) {
      let n = 0;
      for (const c of protectedPool) {
        if (r.id === c.id) continue;
        if (cellMap.has(`${r.id}|${c.id}`)) n++;
      }
      rowCovers.set(r.id, n);
    }
    for (const c of protectedPool) {
      let n = 0;
      for (const r of protectivePool) {
        if (r.id === c.id) continue;
        if (cellMap.has(`${r.id}|${c.id}`)) n++;
      }
      colCoveredBy.set(c.id, n);
    }

    // Sort by parent.name then own name so siblings cluster and SITEs land
    // first. Same key on both axes gives the matrix a coherent diagonal.
    const nameById = new Map<string, string>();
    for (const n of graph.nodes) nameById.set(n.id, n.name);
    const sortKey = (n: AssetGraphNode) => {
      const p = n.parentId ? (nameById.get(n.parentId) ?? '') : '';
      return `${p}\x00${n.name}`;
    };
    protectivePool.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    protectedPool.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    // Apply name search and orphan/uncovered filters.
    const term = filters.search.trim().toLowerCase();
    let rows = protectivePool;
    let cols = protectedPool;
    if (term) {
      rows = rows.filter((n) => n.name.toLowerCase().includes(term));
      cols = cols.filter((n) => n.name.toLowerCase().includes(term));
    }
    if (filters.onlyOrphans) {
      rows = rows.filter((n) => (rowCovers.get(n.id) ?? 0) === 0);
    }
    if (filters.onlyUncovered) {
      cols = cols.filter((n) => (colCoveredBy.get(n.id) ?? 0) === 0);
    }

    let uncoveredCount = 0;
    for (const c of protectedPool) {
      if ((colCoveredBy.get(c.id) ?? 0) === 0) uncoveredCount++;
    }
    let orphanCount = 0;
    for (const r of protectivePool) {
      if ((rowCovers.get(r.id) ?? 0) === 0) orphanCount++;
    }

    return {
      rows, cols, cellMap, rowCovers, colCoveredBy,
      totalProtective: protectivePool.length,
      totalProtected: protectedPool.length,
      uncoveredCount, orphanCount, edgeCount,
    };
  }, [graph, filters]);

  const filtersActive =
    filters.search.trim() !== '' ||
    filters.type !== '' ||
    filters.onlyUncovered ||
    filters.onlyOrphans;

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const subtitle = useMemo(() => {
    if (!graph) return '';
    const parts = [
      `${totalProtective} protective`,
      `${totalProtected} protected`,
      `${edgeCount} ${filters.type ? RELATIONSHIP_TYPE_LABEL[filters.type] : 'relationship'}${edgeCount === 1 ? '' : 's'}`,
    ];
    if (uncoveredCount > 0) parts.push(`${uncoveredCount} uncovered`);
    if (orphanCount > 0) parts.push(`${orphanCount} orphan`);
    return parts.join(' · ');
  }, [graph, totalProtective, totalProtected, edgeCount, uncoveredCount, orphanCount, filters.type]);

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Coverage matrix"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Filter rows / columns…"
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
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as RelationshipType | '' }))}
              className="text-[11.5px] h-7 px-2 border border-n-200 rounded-r1 bg-white"
              title="Narrow to one relationship type"
            >
              <option value="">All types</option>
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t}>{RELATIONSHIP_TYPE_LABEL[t]}</option>
              ))}
            </select>
            <Btn2
              variant={filters.onlyUncovered ? 'primary' : 'ghost'}
              leading={<AlertTriangle size={12} />}
              onClick={() => setFilters((f) => ({ ...f, onlyUncovered: !f.onlyUncovered }))}
              title="Show only protected assets that are not covered by anything"
            >
              Uncovered
            </Btn2>
            <Btn2
              variant={filters.onlyOrphans ? 'primary' : 'ghost'}
              leading={<Filter size={12} />}
              onClick={() => setFilters((f) => ({ ...f, onlyOrphans: !f.onlyOrphans }))}
              title="Show only protective assets that aren't covering anything"
            >
              Orphans
            </Btn2>
            {filtersActive && (
              <Btn2 variant="ghost" onClick={clearFilters}>Clear filters</Btn2>
            )}
          </div>
        }
      />
      <RelationshipsTabBar />

      {error && (
        <div className="text-[12px] text-bad bg-bad-bg border-b border-bad/20 px-4 py-2">{error}</div>
      )}

      <div className="flex-1 overflow-auto bg-n-50">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : !graph || (totalProtective === 0 && totalProtected === 0) ? (
          <EmptyState message="No protective or protected assets yet. Set asset roles under Catalog → Assets to populate this matrix." />
        ) : rows.length === 0 || cols.length === 0 ? (
          <EmptyState
            message={
              filtersActive
                ? 'No rows or columns match the current filters.'
                : totalProtective === 0
                  ? 'No protective assets defined yet.'
                  : 'No protected assets defined yet.'
            }
          />
        ) : (
          <Matrix
            rows={rows}
            cols={cols}
            cellMap={cellMap}
            rowCovers={rowCovers}
            colCoveredBy={colCoveredBy}
            onSelect={open}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center">
      <div className="max-w-md mx-auto text-[12.5px] text-n-500">{message}</div>
    </div>
  );
}

interface MatrixProps {
  rows: AssetGraphNode[];
  cols: AssetGraphNode[];
  cellMap: Map<string, AssetRelationshipSummary[]>;
  rowCovers: Map<string, number>;
  colCoveredBy: Map<string, number>;
  onSelect: (id: string) => void;
}

function Matrix({ rows, cols, cellMap, rowCovers, colCoveredBy, onSelect }: MatrixProps) {
  const appearance = useAppearanceStore((s) => s.appearance);
  return (
    <div className="inline-block min-w-full">
      <table className="border-separate border-spacing-0 text-[11px] text-n-800">
        <thead>
          <tr>
            {/* Top-left corner — sticky on both axes. */}
            <th
              className="sticky top-0 left-0 z-30 bg-white border-b border-r border-n-200 px-3 py-2 text-left font-medium text-n-500 text-[10.5px] uppercase tracking-[0.5px]"
              style={{ minWidth: 240 }}
            >
              Protective ↓ / Protected →
            </th>
            {cols.map((c) => {
              const t = appearance.assetTypeStyles[c.assetType];
              const TypeIcon = resolveIcon(t.iconName);
              const uncovered = (colCoveredBy.get(c.id) ?? 0) === 0;
              return (
                <th
                  key={c.id}
                  className="sticky top-0 z-20 bg-white border-b border-r border-n-100 align-bottom p-0"
                  style={{ width: 26, height: 180 }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    title={c.name}
                    className="group h-full w-full px-0 py-2 inline-flex flex-col items-center justify-end gap-1.5 hover:bg-n-50"
                  >
                    {uncovered && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-warn shrink-0"
                        title="Uncovered — no protective asset covers this"
                      />
                    )}
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-r1 shrink-0"
                      style={{ backgroundColor: t.bg, color: t.ink }}
                    >
                      <TypeIcon size={10} />
                    </span>
                    <span
                      className="text-[10.5px] text-n-700 group-hover:text-a-700 truncate max-w-[160px]"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {c.name}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = appearance.assetTypeStyles[r.assetType];
            const TypeIcon = resolveIcon(t.iconName);
            const covers = rowCovers.get(r.id) ?? 0;
            const orphan = covers === 0;
            return (
              <tr key={r.id} className="hover:bg-n-50/40">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white border-b border-r border-n-100 px-2 py-1 text-left font-normal align-middle"
                  style={{ minWidth: 240, maxWidth: 280 }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="group flex items-center gap-2 w-full text-left"
                  >
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-r1 shrink-0"
                      style={{ backgroundColor: t.bg, color: t.ink }}
                    >
                      <TypeIcon size={11} />
                    </span>
                    <span className="text-[12px] text-n-900 truncate group-hover:text-a-800 flex-1 min-w-0" title={r.name}>
                      {r.name}
                    </span>
                    {orphan ? (
                      <Pill variant="warn" icon={<AlertTriangle />}>0</Pill>
                    ) : (
                      <span className="text-[10px] font-mono text-n-500 shrink-0 tabular-nums" title={`Covers ${covers} protected asset${covers === 1 ? '' : 's'}`}>
                        {covers}
                      </span>
                    )}
                  </button>
                </th>
                {cols.map((c) => {
                  const key = `${r.id}|${c.id}`;
                  const rels = cellMap.get(key);
                  return (
                    <MatrixCell
                      key={key}
                      rowName={r.name}
                      colName={c.name}
                      rels={rels}
                      onClick={() => onSelect(c.id)}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface MatrixCellProps {
  rowName: string;
  colName: string;
  rels: AssetRelationshipSummary[] | undefined;
  onClick: () => void;
}

function MatrixCell({ rowName, colName, rels, onClick }: MatrixCellProps) {
  const filled = !!rels && rels.length > 0;
  const first = filled ? rels![0] : null;
  const Icon = first ? RELATIONSHIP_ICON[first.relationshipType] : null;
  const title = filled
    ? rels!
        .map((r) => `${rowName} ${RELATIONSHIP_TYPE_LABEL[r.relationshipType]} ${colName}${r.description ? ` — ${r.description}` : ''}`)
        .join('\n')
    : `${rowName} → ${colName}: no relationship`;
  return (
    <td
      className={[
        'border-b border-r border-n-100 p-0 text-center align-middle',
        filled ? 'bg-a-50' : 'bg-white',
      ].join(' ')}
      style={{ width: 26, height: 26 }}
    >
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={[
          'block w-full h-full grid place-items-center transition-colors',
          filled ? 'text-a-700 hover:bg-a-100' : 'text-n-300 hover:bg-n-100',
        ].join(' ')}
      >
        {Icon ? (
          <Icon size={11} />
        ) : filled ? (
          <ShieldCheck size={11} />
        ) : null}
        {filled && rels!.length > 1 && (
          <span className="absolute text-[8px] font-mono text-a-800 mt-3 ml-3">{rels!.length}</span>
        )}
      </button>
    </td>
  );
}

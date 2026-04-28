import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeProps, type Connection, type FinalConnectionState,
  type ReactFlowInstance,
  Handle, Position, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useNavigate } from '@tanstack/react-router';
import {
  ChevronDown, ChevronRight, Focus, Search, X, Download, FileImage, FileText, Network,
  Settings, LayoutGrid, Undo2,
} from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Pill } from '../components/hifi/Pill';
import { Btn2 } from '../components/hifi/Btn2';
import { AssetFormDrawer } from '../components/AssetFormDrawer';
import { NodeToolbox } from '../components/relationships/NodeToolbox';
import { ClusterCreatedToast } from '../components/relationships/ClusterCreatedToast';
import { assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  criticalityToRiskLevel,
  RELATIONSHIP_TYPE_LABEL, RELATIONSHIP_TYPES,
  ASSET_ROLE_LABEL, ASSET_ROLE_DESCRIPTION,
  type AssetGraphResponse, type AssetGraphNode, type RelationshipType, type AssetType,
  type AssetRole, type AssetSummary, type RelDirection, type ClusterSummary,
} from '../lib/csmp-types';
import {
  toMermaid, downloadMermaid, exportNodeAsJpeg, exportNodeAsPdfLandscape,
  reactFlowMetaFromGraph,
} from '../lib/export-graph';
import { useAppearanceStore } from '../stores/appearance';
import {
  resolveIcon,
  type AssetRoleStyle, type AssetTypeStyle, type RiskColor,
} from '../lib/appearance-defaults';

const ROLE_SHORT: Record<AssetRole, string> = {
  PROTECTED: 'PROT',
  PROTECTIVE: 'PROTV',
  DUAL: 'DUAL',
};

// ─── custom node

type GraphNodeData = {
  name: string;
  assetType: AssetType;
  criticality: number;
  status: string;
  assetRole: AssetRole;
  hasChildren: boolean;
  collapsed: boolean;
  childCount: number;
  selected: boolean;
  // Per-org appearance slices, resolved at the page level and passed in so
  // AssetNode stays a pure function of node data (xyflow memoizes by `data`).
  roleStyle: AssetRoleStyle;
  typeStyle: AssetTypeStyle;
  riskColor: RiskColor;
  onToggleCollapse: (id: string) => void;
  onIsolate: (id: string) => void;
  onOpenToolbox: (id: string) => void;
};

function AssetNode({ id, data }: NodeProps<Node<GraphNodeData>>) {
  const r = data.roleStyle;
  const t = data.typeStyle;
  const RoleIcon = resolveIcon(r.iconName);
  return (
    <div
      className={[
        'group relative rounded-r2 px-3 py-2 shadow-sh1 min-w-[180px] max-w-[240px]',
        'bg-white hover:shadow-sh2 transition-shadow',
        data.selected ? 'ring-2 ring-a-500 ring-offset-1' : '',
      ].join(' ')}
      style={{
        borderColor: r.borderColor,
        borderWidth: r.borderWidth,
        borderStyle: r.borderStyle,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-n-400" />

      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity csmp-no-export">
        <button
          type="button"
          aria-label="Open node toolbox"
          onClick={(e) => { e.stopPropagation(); data.onOpenToolbox(id); }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded-r1 bg-white/90 border border-n-200 grid place-items-center text-n-600 hover:text-a-700 hover:border-a-400"
          title="Open toolbox (or double-click node)"
        >
          <Settings size={11} />
        </button>
        <button
          type="button"
          aria-label="Isolate this node and its children"
          onClick={(e) => { e.stopPropagation(); data.onIsolate(id); }}
          className="w-5 h-5 rounded-r1 bg-white/90 border border-n-200 grid place-items-center text-n-600 hover:text-a-700 hover:border-a-400"
          title="Isolate (show only this branch)"
        >
          <Focus size={11} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 pr-12">
        <span
          className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-r1"
          style={{ backgroundColor: t.bg, color: t.ink }}
        >
          {t.abbr}
        </span>
        <span
          className="inline-flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-r1"
          style={{ backgroundColor: r.chipBg, color: r.chipInk }}
          title={`${ASSET_ROLE_LABEL[data.assetRole]} — ${ASSET_ROLE_DESCRIPTION[data.assetRole]}`}
        >
          <RoleIcon size={9} />
          {ROLE_SHORT[data.assetRole]}
        </span>
        <span className="text-[10px] font-mono text-n-400 tracking-[0.4px]">C{data.criticality}</span>
        {data.collapsed && data.childCount > 0 && (
          <span className="text-[9.5px] font-mono text-a-700 bg-a-50 px-1 rounded-r1">+{data.childCount}</span>
        )}
      </div>
      <div className="text-[12.5px] font-medium text-n-900 mt-1 truncate" title={data.name}>
        {data.name}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-n-400" />

      {data.hasChildren && (
        <button
          type="button"
          aria-label={data.collapsed ? 'Expand children' : 'Collapse children'}
          onClick={(e) => { e.stopPropagation(); data.onToggleCollapse(id); }}
          className="absolute -right-2 -bottom-2 w-5 h-5 rounded-full bg-white border border-n-300 grid place-items-center text-n-700 hover:bg-n-50 shadow-sh1 csmp-no-export"
          title={data.collapsed ? `Expand (${data.childCount})` : `Collapse (${data.childCount})`}
        >
          {data.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </button>
      )}
    </div>
  );
}

const nodeTypes = { asset: AssetNode };

// ─── dagre layout

const NODE_W = 200;
const NODE_H = 60;

function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 90, nodesep: 40, marginx: 20, marginy: 20 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

// ─── descendants helper (parentId tree)

function buildChildrenMap(nodes: AssetGraphNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const arr = map.get(n.parentId);
      if (arr) arr.push(n.id);
      else map.set(n.parentId, [n.id]);
    }
  }
  return map;
}

function descendantsOf(rootId: string, childrenMap: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  const stack = [...(childrenMap.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of childrenMap.get(id) ?? []) stack.push(c);
  }
  return out;
}

const COLLAPSED_KEY = 'csmp.rel.collapsed';

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsed(ids: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

// ─── persistent positions

const POSITIONS_KEY = 'csmp.rel.positions';
type PosMap = Record<string, { x: number; y: number }>;

function loadPositions(): PosMap {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return {};
    const out: PosMap = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (
        v && typeof v === 'object'
        && typeof (v as { x?: unknown }).x === 'number'
        && typeof (v as { y?: unknown }).y === 'number'
      ) {
        out[k] = { x: (v as { x: number }).x, y: (v as { y: number }).y };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function savePositions(map: PosMap) {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

// Run dagre on the FULL graph (all nodes + relationship + hierarchy edges)
// so layout is stable regardless of current filter / collapse state.
function layoutFullGraph(g: AssetGraphResponse): PosMap {
  const allNodes: Node[] = g.nodes.map((n) => ({
    id: n.id, type: 'asset', position: { x: 0, y: 0 }, data: {} as never,
  }));
  const allEdges: Edge[] = [
    ...g.edges.map((e) => ({ id: e.id, source: e.sourceAssetId, target: e.targetAssetId })),
    ...g.nodes
      .filter((n) => n.parentId)
      .map((n) => ({ id: `hier-${n.parentId}-${n.id}`, source: n.parentId!, target: n.id })),
  ];
  const laid = layoutWithDagre(allNodes, allEdges);
  const out: PosMap = {};
  for (const n of laid) out[n.id] = n.position;
  return out;
}

// Merge dagre-computed positions into prev, only filling in missing ids.
// Existing manual positions are preserved.
function seedMissingPositions(prev: PosMap, g: AssetGraphResponse): PosMap {
  const missing = g.nodes.some((n) => !prev[n.id]);
  if (!missing) return prev;
  const fresh = layoutFullGraph(g);
  const next: PosMap = { ...prev };
  for (const id of Object.keys(fresh)) {
    if (!next[id]) next[id] = fresh[id];
  }
  return next;
}

// ─── relationship modal

interface RelationshipDialogProps {
  sourceName: string;
  targetName: string;
  onSubmit: (data: {
    relationshipType: RelationshipType;
    direction: RelDirection;
    impactPropagation: boolean;
    description: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

function RelationshipDialog({ sourceName, targetName, onSubmit, onClose }: RelationshipDialogProps) {
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('DEPENDS_ON');
  const [direction, setDirection] = useState<RelDirection>('UNIDIRECTIONAL');
  const [impactPropagation, setImpactPropagation] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        relationshipType,
        direction,
        impactPropagation,
        description: description.trim() ? description.trim() : null,
      });
    } catch (err) {
      setError(await extractError(err));
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30 csmp-no-export" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Define relationship"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] max-w-[92vw] bg-white rounded-r2 shadow-sh3 border border-n-200 z-40 csmp-no-export"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-n-100">
          <div>
            <div className="text-[13.5px] font-semibold text-n-900">New relationship</div>
            <div className="text-[11.5px] text-n-500 mt-0.5 truncate" title={`${sourceName} → ${targetName}`}>
              <span className="font-medium text-n-800">{sourceName}</span>
              <span className="mx-1.5 text-n-400">→</span>
              <span className="font-medium text-n-800">{targetName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-7 h-7 grid place-items-center text-n-500 hover:text-n-800 hover:bg-n-50 rounded-r1"
          >
            <X size={14} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
          <label className="block">
            <span className="text-[11.5px] text-n-600 font-medium">Type</span>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
              className="mt-1 w-full text-[12.5px] h-8 px-2 border border-n-200 rounded-r1 bg-white"
              autoFocus
            >
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t}>{RELATIONSHIP_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11.5px] text-n-600 font-medium">Direction</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as RelDirection)}
              className="mt-1 w-full text-[12.5px] h-8 px-2 border border-n-200 rounded-r1 bg-white"
            >
              <option value="UNIDIRECTIONAL">Unidirectional (source → target)</option>
              <option value="BIDIRECTIONAL">Bidirectional</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-[12px] text-n-700">
            <input
              type="checkbox"
              checked={impactPropagation}
              onChange={(e) => setImpactPropagation(e.target.checked)}
              className="w-3.5 h-3.5 accent-a-600"
            />
            Propagate impact along this edge
          </label>

          <label className="block">
            <span className="text-[11.5px] text-n-600 font-medium">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Why does this relationship matter?"
              className="mt-1 w-full text-[12.5px] px-2 py-1.5 border border-n-200 rounded-r1 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-a-500"
            />
          </label>

          {error && (
            <div className="text-[11.5px] text-bad bg-bad-bg border border-bad/20 rounded-r1 px-2 py-1.5">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Btn2 type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn2>
            <Btn2 type="submit" variant="primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create relationship'}
            </Btn2>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── page

export function RelationshipsPage() {
  const navigate = useNavigate();
  const [graph, setGraph] = useState<AssetGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeHierarchy, setIncludeHierarchy] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RelationshipType | ''>('');
  const [roleFilter, setRoleFilter] = useState<AssetRole | ''>('');
  const [nameFilter, setNameFilter] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => loadCollapsed());
  const [isolatedId, setIsolatedId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [assetSummaries, setAssetSummaries] = useState<AssetSummary[]>([]);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [createChildOf, setCreateChildOf] = useState<string | null>(null);
  const [positions, setPositions] = useState<PosMap>(() => loadPositions());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toolboxNodeId, setToolboxNodeId] = useState<string | null>(null);
  const [createdClusterToast, setCreatedClusterToast] = useState<ClusterSummary | null>(null);
  const [editAssetId, setEditAssetId] = useState<string | null>(null);
  const [arrangeUndo, setArrangeUndo] = useState(false);
  const prevPositionsRef = useRef<PosMap | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const flowWrapRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [fitViewTick, setFitViewTick] = useState(0);
  const requestFitView = useCallback(() => setFitViewTick((t) => t + 1), []);

  // Per-org appearance, hydrated by RequireAuth on app boot.
  const appearance = useAppearanceStore((s) => s.appearance);

  const refreshAll = useCallback(async () => {
    try {
      const [g, list] = await Promise.all([
        assetsApi.graph(),
        assetsApi.list({ pageSize: 200 }),
      ]);
      setPositions((prev) => seedMissingPositions(prev, g));
      setGraph(g);
      setAssetSummaries(list.items);
    } catch (err) {
      setError(await extractError(err));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await refreshAll();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAll]);

  useEffect(() => { saveCollapsed(collapsedIds); }, [collapsedIds]);
  useEffect(() => { savePositions(positions); }, [positions]);

  // Re-frame the camera after isolate / arrange / clear-filter actions.
  // Triggered explicitly via requestFitView(); waits one frame so React
  // Flow has rendered the new node/position set before we measure.
  useEffect(() => {
    if (fitViewTick === 0 || !flowInstanceRef.current) return;
    const raf = window.requestAnimationFrame(() => {
      flowInstanceRef.current?.fitView({ padding: 0.2, duration: 350 });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [fitViewTick]);

  useEffect(() => () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  }, []);

  // Esc clears isolation, closes menus, dismisses toast, deselects
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (toolboxNodeId) { setToolboxNodeId(null); return; }
      if (arrangeUndo) {
        setArrangeUndo(false);
        prevPositionsRef.current = null;
        if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
        return;
      }
      if (exportOpen) { setExportOpen(false); return; }
      if (isolatedId) { setIsolatedId(null); requestFitView(); return; }
      if (selectedNodeId) { setSelectedNodeId(null); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isolatedId, exportOpen, toolboxNodeId, arrangeUndo, selectedNodeId, requestFitView]);

  // Outside-click closes export menu
  useEffect(() => {
    if (!exportOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (exportMenuRef.current && target && !exportMenuRef.current.contains(target)) {
        setExportOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [exportOpen]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleIsolate = useCallback((id: string) => {
    setIsolatedId(id);
    requestFitView();
  }, [requestFitView]);

  const handleOpenToolbox = useCallback((id: string) => {
    setSelectedNodeId(id);
    setToolboxNodeId(id);
  }, []);

  const childrenMap = useMemo(
    () => (graph ? buildChildrenMap(graph.nodes) : new Map<string, string[]>()),
    [graph],
  );

  const isolatedName = useMemo(() => {
    if (!isolatedId || !graph) return null;
    return graph.nodes.find((n) => n.id === isolatedId)?.name ?? null;
  }, [isolatedId, graph]);

  const isolatedDescendants = useMemo(() => {
    if (!isolatedId) return null;
    return descendantsOf(isolatedId, childrenMap);
  }, [isolatedId, childrenMap]);

  const { nodes, edges, edgeCount, hiddenByCollapse, hiddenByFilter, totalMatches } = useMemo(() => {
    if (!graph) {
      return {
        nodes: [] as Node[], edges: [] as Edge[], edgeCount: 0,
        hiddenByCollapse: 0, hiddenByFilter: 0, totalMatches: 0,
      };
    }

    // 1. collapse → hide all descendants of collapsed nodes
    const hiddenCollapse = new Set<string>();
    for (const id of collapsedIds) {
      for (const d of descendantsOf(id, childrenMap)) hiddenCollapse.add(d);
    }

    // 2. isolate → keep only {isolatedId} ∪ descendants
    let isolateAllow: Set<string> | null = null;
    if (isolatedId && isolatedDescendants) {
      isolateAllow = new Set(isolatedDescendants);
      isolateAllow.add(isolatedId);
    }

    // 3. name filter (case-insensitive substring)
    const term = nameFilter.trim().toLowerCase();
    const nameMatches = (n: AssetGraphNode) => !term || n.name.toLowerCase().includes(term);

    // 4. role filter (PROTECTED / PROTECTIVE / DUAL)
    const roleMatches = (n: AssetGraphNode) => !roleFilter || n.assetRole === roleFilter;

    let filterMatched = 0;
    let filterHidden = 0;
    for (const n of graph.nodes) {
      if (nameMatches(n) && roleMatches(n)) filterMatched += 1;
      else filterHidden += 1;
    }

    const visibleNodeIds = new Set<string>();
    for (const n of graph.nodes) {
      if (hiddenCollapse.has(n.id)) continue;
      if (isolateAllow && !isolateAllow.has(n.id)) continue;
      if (!nameMatches(n)) continue;
      if (!roleMatches(n)) continue;
      visibleNodeIds.add(n.id);
    }

    const rawNodes: Node[] = graph.nodes
      .filter((n) => visibleNodeIds.has(n.id))
      .map((n: AssetGraphNode) => {
        const childCount = (childrenMap.get(n.id) ?? []).length;
        const level = criticalityToRiskLevel(n.criticality);
        return {
          id: n.id,
          type: 'asset',
          position: positions[n.id] ?? { x: 0, y: 0 },
          selected: selectedNodeId === n.id,
          data: {
            name: n.name,
            assetType: n.assetType,
            criticality: n.criticality,
            status: n.status,
            assetRole: n.assetRole,
            hasChildren: childCount > 0,
            collapsed: collapsedIds.has(n.id),
            childCount,
            selected: selectedNodeId === n.id,
            roleStyle: appearance.assetRoleStyles[n.assetRole],
            typeStyle: appearance.assetTypeStyles[n.assetType],
            riskColor: appearance.riskColors[level],
            onToggleCollapse: toggleCollapse,
            onIsolate: handleIsolate,
            onOpenToolbox: handleOpenToolbox,
          } satisfies GraphNodeData,
        };
      });

    const relEdges: Edge[] = graph.edges
      .filter((e) => !typeFilter || e.relationshipType === typeFilter)
      .filter((e) => visibleNodeIds.has(e.sourceAssetId) && visibleNodeIds.has(e.targetAssetId))
      .map((e) => {
        const es = appearance.edgeStyles[e.relationshipType];
        return {
          id: e.id,
          source: e.sourceAssetId,
          target: e.targetAssetId,
          label: es.showLabel ? RELATIONSHIP_TYPE_LABEL[e.relationshipType] : undefined,
          animated: e.impactPropagation,
          markerEnd: { type: MarkerType.ArrowClosed, color: es.stroke },
          style: {
            stroke: es.stroke,
            strokeWidth: es.strokeWidth,
            ...(es.dashArray ? { strokeDasharray: es.dashArray } : {}),
          },
          labelStyle: { fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#373735' },
          labelBgStyle: { fill: '#ffffff' },
          labelBgPadding: [4, 2] as [number, number],
        };
      });

    const hierEdges: Edge[] = includeHierarchy
      ? graph.nodes
          .filter((n) => n.parentId)
          .filter((n) => visibleNodeIds.has(n.id) && visibleNodeIds.has(n.parentId!))
          .map((n) => ({
            id: `hier-${n.parentId}-${n.id}`,
            source: n.parentId!,
            target: n.id,
            label: 'contains',
            style: { stroke: '#c4c4c0', strokeDasharray: '4 3' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#c4c4c0' },
            labelStyle: { fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fill: '#9a9a96' },
            labelBgStyle: { fill: '#ffffff' },
            labelBgPadding: [3, 2] as [number, number],
          }))
      : [];

    const allEdges = [...hierEdges, ...relEdges];
    return {
      nodes: rawNodes,
      edges: allEdges,
      edgeCount: relEdges.length,
      hiddenByCollapse: hiddenCollapse.size,
      hiddenByFilter: filterHidden,
      totalMatches: filterMatched,
    };
  }, [graph, includeHierarchy, typeFilter, roleFilter, nameFilter, collapsedIds, childrenMap, isolatedId, isolatedDescendants, toggleCollapse, handleIsolate, handleOpenToolbox, positions, selectedNodeId, appearance]);

  const handleNodeClick = useCallback((_evt: unknown, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleNodeDoubleClick = useCallback((_evt: unknown, node: Node) => {
    setSelectedNodeId(node.id);
    setToolboxNodeId(node.id);
  }, []);

  const handleNodeDragStop = useCallback((_evt: unknown, node: Node) => {
    setPositions((prev) => ({ ...prev, [node.id]: node.position }));
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleArrange = useCallback(() => {
    if (!graph || nodes.length === 0) return;
    prevPositionsRef.current = positions;
    // Lay out only the currently-visible set so collapsed branches don't
    // reserve empty space. Hidden nodes keep their previous positions
    // (preserved via merge), so expanding a parent later restores them
    // where they were.
    const inputNodes: Node[] = nodes.map((n) => ({
      id: n.id, type: n.type, position: { x: 0, y: 0 }, data: {} as never,
    }));
    const laid = layoutWithDagre(inputNodes, edges);
    const next: PosMap = { ...positions };
    for (const n of laid) next[n.id] = n.position;
    setPositions(next);
    setArrangeUndo(true);
    requestFitView();
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setArrangeUndo(false);
      prevPositionsRef.current = null;
    }, 10000);
  }, [graph, positions, nodes, edges, requestFitView]);

  const handleUndoArrange = useCallback(() => {
    if (!prevPositionsRef.current) return;
    setPositions(prevPositionsRef.current);
    prevPositionsRef.current = null;
    setArrangeUndo(false);
    requestFitView();
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  }, [requestFitView]);

  const handleOpenInAssets = useCallback((id: string) => {
    void navigate({ to: '/assets', search: { assetId: id } as never });
  }, [navigate]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    setPendingConnection({ source: connection.source, target: connection.target });
  }, []);

  const handleConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    if (state.isValid) return; // valid drop already handled by onConnect
    const fromId = state.fromNode?.id;
    if (!fromId) return;
    // Drop counts as "empty space" only if the drop target is the React Flow pane,
    // not another node/handle/edge that simply rejected the connection.
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const onPane = target.classList?.contains('react-flow__pane');
    if (!onPane) return;
    setCreateChildOf(fromId);
  }, []);

  const submitRelationship = useCallback(async (data: {
    relationshipType: RelationshipType;
    direction: RelDirection;
    impactPropagation: boolean;
    description: string | null;
  }) => {
    if (!pendingConnection) return;
    await assetsApi.createRelationship({
      sourceAssetId: pendingConnection.source,
      targetAssetId: pendingConnection.target,
      ...data,
    });
    setPendingConnection(null);
    await refreshAll();
  }, [pendingConnection, refreshAll]);

  const sourceName = useMemo(() => {
    if (!pendingConnection || !graph) return '';
    return graph.nodes.find((n) => n.id === pendingConnection.source)?.name ?? pendingConnection.source;
  }, [pendingConnection, graph]);

  const targetName = useMemo(() => {
    if (!pendingConnection || !graph) return '';
    return graph.nodes.find((n) => n.id === pendingConnection.target)?.name ?? pendingConnection.target;
  }, [pendingConnection, graph]);

  const handleClearAll = useCallback(() => {
    setNameFilter('');
    setTypeFilter('');
    setRoleFilter('');
    setCollapsedIds(new Set());
    setIsolatedId(null);
    requestFitView();
  }, [requestFitView]);

  const captureTarget = useCallback((): HTMLElement | null => {
    if (!flowWrapRef.current) return null;
    return flowWrapRef.current.querySelector<HTMLElement>('.react-flow') ?? flowWrapRef.current;
  }, []);

  const handleExportMermaid = useCallback(() => {
    const meta = reactFlowMetaFromGraph(nodes, edges);
    const text = toMermaid(meta.nodes, meta.edges);
    downloadMermaid(`relationships-${Date.now()}`, text);
    setExportOpen(false);
  }, [nodes, edges]);

  const handleExportJpg = useCallback(async () => {
    const target = captureTarget();
    if (!target) return;
    setExportBusy(true);
    try {
      await exportNodeAsJpeg(target, `relationships-${Date.now()}.jpg`);
    } catch (err) {
      setError(`Failed to export JPG: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportBusy(false);
      setExportOpen(false);
    }
  }, [captureTarget]);

  const handleExportPdf = useCallback(async () => {
    const target = captureTarget();
    if (!target) return;
    setExportBusy(true);
    try {
      await exportNodeAsPdfLandscape(target, `relationships-${Date.now()}.pdf`);
    } catch (err) {
      setError(`Failed to export PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportBusy(false);
      setExportOpen(false);
    }
  }, [captureTarget]);

  const subtitle = useMemo(() => {
    if (!graph) return 'Loading graph…';
    const parts = [`${graph.nodes.length} assets`, `${graph.edges.length} edges`];
    if (includeHierarchy) parts.push(`${graph.nodes.filter((n) => n.parentId).length} hierarchy`);
    if (collapsedIds.size > 0) parts.push(`${hiddenByCollapse} hidden by collapse`);
    if (nameFilter.trim()) parts.push(`${totalMatches} match${totalMatches === 1 ? '' : 'es'}`);
    return parts.join(' · ');
  }, [graph, includeHierarchy, collapsedIds, hiddenByCollapse, nameFilter, totalMatches]);

  const showEmptyMatches = !!graph && nodes.length === 0 && nameFilter.trim().length > 0;
  const showEmptyAssets = !!graph && graph.nodes.length === 0;
  const showEmptyEdges = !!graph && !showEmptyMatches && !showEmptyAssets && edgeCount === 0 && !includeHierarchy && !isolatedId;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Asset Relationships"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Filter by name…"
                className="text-[11.5px] h-7 pl-6 pr-6 border border-n-200 rounded-r1 bg-white w-44 focus:outline-none focus:ring-1 focus:ring-a-500"
              />
              {nameFilter && (
                <button
                  type="button"
                  aria-label="Clear name filter"
                  onClick={() => setNameFilter('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 grid place-items-center text-n-500 hover:text-n-800"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-[11.5px] text-n-600">
              <input
                type="checkbox"
                checked={includeHierarchy}
                onChange={(e) => setIncludeHierarchy(e.target.checked)}
                className="w-3.5 h-3.5 accent-a-600"
              />
              Show hierarchy
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as RelationshipType | '')}
              className="text-[11.5px] h-7 px-2 border border-n-200 rounded-r1 bg-white"
              title="Filter edges by relationship type"
            >
              <option value="">All types</option>
              {Object.entries(RELATIONSHIP_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as AssetRole | '')}
              className="text-[11.5px] h-7 px-2 border border-n-200 rounded-r1 bg-white"
              title="Filter nodes by asset role"
            >
              <option value="">All roles</option>
              <option value="PROTECTED">Protected</option>
              <option value="PROTECTIVE">Protective</option>
              <option value="DUAL">Dual</option>
            </select>

            <Btn2
              variant="secondary"
              onClick={handleArrange}
              disabled={!graph || graph.nodes.length === 0}
              leading={<LayoutGrid size={12} />}
              title="Re-run automatic layout (clears manual positions)"
            >
              Arrange
            </Btn2>

            <div className="relative" ref={exportMenuRef}>
              <Btn2
                variant="secondary"
                onClick={() => setExportOpen((v) => !v)}
                disabled={exportBusy || !graph || nodes.length === 0}
                leading={<Download size={12} />}
              >
                {exportBusy ? 'Exporting…' : 'Export'}
              </Btn2>
              {exportOpen && (
                <div className="absolute right-0 top-9 z-20 bg-white border border-n-200 rounded-r2 shadow-sh2 w-48 py-1 csmp-no-export">
                  <button
                    type="button"
                    onClick={handleExportMermaid}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-n-800 hover:bg-n-50 text-left"
                  >
                    <Network size={12} className="text-n-500" />
                    Mermaid (.mmd)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJpg}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-n-800 hover:bg-n-50 text-left"
                  >
                    <FileImage size={12} className="text-n-500" />
                    JPG image
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-n-800 hover:bg-n-50 text-left"
                  >
                    <FileText size={12} className="text-n-500" />
                    PDF (landscape A4)
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {isolatedId && (
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 bg-a-50 border-b border-a-100 csmp-no-export">
          <div className="flex items-center gap-2 text-[11.5px] text-a-800">
            <Pill variant="accent" icon={<Focus />}>Isolated</Pill>
            <span className="font-medium truncate">{isolatedName ?? isolatedId}</span>
            <span className="text-a-700">· {(isolatedDescendants?.size ?? 0)} descendant{(isolatedDescendants?.size ?? 0) === 1 ? '' : 's'} visible</span>
          </div>
          <button
            type="button"
            onClick={() => { setIsolatedId(null); requestFitView(); }}
            className="text-[11.5px] text-a-700 hover:text-a-900 underline-offset-2 hover:underline inline-flex items-center gap-1"
          >
            <X size={12} /> Show all
          </button>
        </div>
      )}

      {error && (
        <div className="text-[12px] text-bad bg-bad-bg border-b border-bad/20 px-4 py-2">{error}</div>
      )}

      <div className="flex-1 relative bg-n-50" ref={flowWrapRef}>
        {loading ? (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : showEmptyAssets ? (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="max-w-md">
              <div className="text-[13px] text-n-700 font-medium">No assets yet</div>
              <div className="text-[11.5px] text-n-500 mt-1">
                Add assets under Catalog → Assets, then create relationships to see them graphed.
              </div>
            </div>
          </div>
        ) : showEmptyMatches ? (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="max-w-md">
              <div className="text-[13px] text-n-700 font-medium">No matches for &ldquo;{nameFilter}&rdquo;</div>
              <div className="text-[11.5px] text-n-500 mt-1 mb-3">
                Try a different search term or clear the active filters.
              </div>
              <Btn2 variant="secondary" onClick={handleClearAll}>Clear all filters</Btn2>
            </div>
          </div>
        ) : showEmptyEdges ? (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="max-w-md">
              <div className="text-[13px] text-n-700 font-medium">No relationships yet</div>
              <div className="text-[11.5px] text-n-500 mt-1">
                Create explicit asset-to-asset relationships via the API, or enable <em>Show hierarchy</em> to view parent/child structure.
              </div>
              <div className="mt-3">
                <Pill variant="info">Tip: <code>POST /api/assets/relationships</code></Pill>
              </div>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={(instance) => { flowInstanceRef.current = instance; }}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeDragStop={handleNodeDragStop}
            onPaneClick={handlePaneClick}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e6e6e4" gap={16} />
            <Controls position="bottom-right" showInteractive={false} />
            <MiniMap
              nodeColor={(n) => {
                const lv = criticalityToRiskLevel((n.data as GraphNodeData).criticality);
                return {
                  Negligible: '#e5e5e2', Low: '#d4e3cf', Moderate: '#f5e4a7',
                  High: '#f4c59a', Extreme: '#eea494',
                }[lv];
              }}
              maskColor="rgba(255,255,255,0.7)"
              pannable
              zoomable
            />
          </ReactFlow>
        )}
        {hiddenByFilter > 0 && !showEmptyMatches && (
          <div className="absolute bottom-2 left-2 text-[10.5px] text-n-500 bg-white/80 border border-n-200 rounded-r1 px-2 py-0.5 csmp-no-export">
            {hiddenByFilter} hidden by name filter
          </div>
        )}
        {arrangeUndo && (
          <div
            role="status"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[12px] text-n-800 bg-white border border-n-200 rounded-r2 shadow-sh2 px-3 py-1.5 csmp-no-export"
          >
            <span>Layout rearranged</span>
            <button
              type="button"
              onClick={handleUndoArrange}
              className="inline-flex items-center gap-1 text-a-700 hover:text-a-800 font-medium"
            >
              <Undo2 size={12} /> Undo
            </button>
          </div>
        )}
      </div>

      {toolboxNodeId && graph && (
        <NodeToolbox
          key={`toolbox-${toolboxNodeId}`}
          graph={graph}
          nodeId={toolboxNodeId}
          collapsed={collapsedIds.has(toolboxNodeId)}
          onClose={() => setToolboxNodeId(null)}
          onEdit={() => {
            setEditAssetId(toolboxNodeId);
            setToolboxNodeId(null);
          }}
          onOpenInAssets={() => {
            handleOpenInAssets(toolboxNodeId);
          }}
          onIsolate={() => {
            setIsolatedId(toolboxNodeId);
            setToolboxNodeId(null);
          }}
          onToggleCollapse={() => {
            toggleCollapse(toolboxNodeId);
          }}
          onAddChild={() => {
            setCreateChildOf(toolboxNodeId);
            setToolboxNodeId(null);
          }}
          onDeleteRelationship={async (relId) => {
            await assetsApi.removeRelationship(relId);
            await refreshAll();
          }}
          onClusterCreated={(cluster) => setCreatedClusterToast(cluster)}
        />
      )}

      {createdClusterToast && (
        <ClusterCreatedToast
          key={createdClusterToast.id}
          cluster={createdClusterToast}
          onDismiss={() => setCreatedClusterToast(null)}
        />
      )}

      {editAssetId && (
        <AssetFormDrawer
          key={`edit-${editAssetId}`}
          mode={{ kind: 'edit', id: editAssetId }}
          availableParents={assetSummaries}
          onClose={() => setEditAssetId(null)}
          onSaved={() => {
            setEditAssetId(null);
            void refreshAll();
          }}
        />
      )}

      {pendingConnection && (
        <RelationshipDialog
          sourceName={sourceName}
          targetName={targetName}
          onSubmit={submitRelationship}
          onClose={() => setPendingConnection(null)}
        />
      )}

      {createChildOf && (
        <AssetFormDrawer
          key={`create-child-of-${createChildOf}`}
          mode={{ kind: 'create', parentId: createChildOf }}
          availableParents={assetSummaries}
          onClose={() => setCreateChildOf(null)}
          onSaved={() => {
            setCreateChildOf(null);
            void refreshAll();
          }}
        />
      )}
    </div>
  );
}

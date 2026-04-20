import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeProps,
  Handle, Position, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useNavigate } from '@tanstack/react-router';
import { Topbar } from '../components/shell/Topbar';
import { Pill } from '../components/hifi/Pill';
import { assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  criticalityToRiskLevel,
  RELATIONSHIP_TYPE_LABEL,
  type AssetGraphResponse, type AssetGraphNode, type RelationshipType, type AssetType,
} from '../lib/csmp-types';

// ─── colors: pick a risk-heat pair keyed to criticality

const RISK_CLASSES: Record<ReturnType<typeof criticalityToRiskLevel>, { bg: string; border: string; ink: string }> = {
  Negligible: { bg: 'bg-r-neg',  border: 'border-n-300',   ink: 'text-r-negInk' },
  Low:        { bg: 'bg-r-low',  border: 'border-r-lowInk/40', ink: 'text-r-lowInk' },
  Moderate:   { bg: 'bg-r-mod',  border: 'border-r-modInk/40', ink: 'text-r-modInk' },
  High:       { bg: 'bg-r-high', border: 'border-r-highInk/40', ink: 'text-r-highInk' },
  Extreme:    { bg: 'bg-r-ext',  border: 'border-r-extInk/40', ink: 'text-r-extInk' },
};

const ASSET_TYPE_SHORT: Partial<Record<AssetType, string>> = {
  SITE: 'SITE', BUILDING: 'BLDG', FLOOR: 'FL', ROOM: 'ROOM',
  ZONE: 'ZONE', EQUIPMENT: 'EQ', VEHICLE: 'VEH', PERSON: 'PER',
  INFORMATION: 'INFO', IP: 'IP', PROCESS: 'PROC', REPUTATION: 'REP', CONTINUITY: 'CONT',
};

// ─── custom node

type GraphNodeData = {
  name: string;
  assetType: AssetType;
  criticality: number;
  status: string;
};

function AssetNode({ data }: NodeProps<Node<GraphNodeData>>) {
  const level = criticalityToRiskLevel(data.criticality);
  const c = RISK_CLASSES[level];
  return (
    <div
      className={[
        'rounded-r2 border px-3 py-2 shadow-sh1 min-w-[160px] max-w-[220px]',
        'bg-white hover:shadow-sh2 transition-shadow',
        c.border,
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} className="!bg-n-400" />
      <div className="flex items-center gap-2">
        <span className={['text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-r1', c.bg, c.ink].join(' ')}>
          {ASSET_TYPE_SHORT[data.assetType] ?? data.assetType}
        </span>
        <span className="text-[10px] font-mono text-n-400 tracking-[0.4px]">C{data.criticality}</span>
      </div>
      <div className="text-[12.5px] font-medium text-n-900 mt-1 truncate" title={data.name}>
        {data.name}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-n-400" />
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

// ─── page

export function RelationshipsPage() {
  const navigate = useNavigate();
  const [graph, setGraph] = useState<AssetGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeHierarchy, setIncludeHierarchy] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RelationshipType | ''>('');

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const g = await assetsApi.graph();
        setGraph(g);
      } catch (err) {
        setError(await extractError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { nodes, edges, edgeCount } = useMemo(() => {
    if (!graph) return { nodes: [] as Node[], edges: [] as Edge[], edgeCount: 0 };

    const rawNodes: Node[] = graph.nodes.map((n: AssetGraphNode) => ({
      id: n.id,
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        name: n.name,
        assetType: n.assetType,
        criticality: n.criticality,
        status: n.status,
      } satisfies GraphNodeData,
    }));

    const relEdges: Edge[] = graph.edges
      .filter((e) => !typeFilter || e.relationshipType === typeFilter)
      .map((e) => ({
        id: e.id,
        source: e.sourceAssetId,
        target: e.targetAssetId,
        label: RELATIONSHIP_TYPE_LABEL[e.relationshipType],
        animated: e.impactPropagation,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#72726e' },
        style: { stroke: '#72726e', strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#373735' },
        labelBgStyle: { fill: '#ffffff' },
        labelBgPadding: [4, 2] as [number, number],
      }));

    const hierEdges: Edge[] = includeHierarchy
      ? graph.nodes
          .filter((n) => n.parentId)
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
      nodes: layoutWithDagre(rawNodes, allEdges),
      edges: allEdges,
      edgeCount: relEdges.length,
    };
  }, [graph, includeHierarchy, typeFilter]);

  const handleNodeClick = useCallback((_evt: unknown, node: Node) => {
    void navigate({ to: '/assets', search: { assetId: node.id } as never });
  }, [navigate]);

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Asset Relationships"
        subtitle={
          graph
            ? `${graph.nodes.length} assets · ${graph.edges.length} edges${includeHierarchy ? ` + ${graph.nodes.filter((n) => n.parentId).length} hierarchy` : ''}`
            : 'Loading graph…'
        }
        actions={
          <div className="flex items-center gap-2">
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
            >
              <option value="">All types</option>
              {Object.entries(RELATIONSHIP_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        }
      />

      {error && (
        <div className="text-[12px] text-bad bg-bad-bg border-b border-bad/20 px-4 py-2">{error}</div>
      )}

      <div className="flex-1 relative bg-n-50">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : graph && graph.nodes.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="max-w-md">
              <div className="text-[13px] text-n-700 font-medium">No assets yet</div>
              <div className="text-[11.5px] text-n-500 mt-1">
                Add assets under Catalog → Assets, then create relationships to see them graphed.
              </div>
            </div>
          </div>
        ) : graph && edgeCount === 0 && !includeHierarchy ? (
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
            onNodeClick={handleNodeClick}
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
      </div>
    </div>
  );
}

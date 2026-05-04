import { useEffect, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node } from '@xyflow/react';

// ELK layered layout for the relationship graph.
//
// Phase 2 swaps dagre for ELK so we can use *nested* layout: BUILDINGs
// visually contain their ROOMs/EQUIPMENT/ZONEs on the canvas, replacing
// the 'contains' edges with literal nesting. Coverage edges (PROTECTS /
// MONITORS / DEPENDS_ON) stay as routed lines on the now-clean canvas.
//
// ELK is async; we run it once per (nodes, edges) signature and cache the
// result so re-renders don't re-layout. Manual drags are persisted by the
// caller and short-circuit the ELK output for any node the user has
// touched.

const elk = new ELK();

const NODE_W = 200;
const NODE_H = 60;
const GROUP_PAD_TOP = 36; // header height inside a group container
const GROUP_PAD_OTHER = 12;

export interface LayoutInputNode {
  id: string;
  parentId: string | null;
  hasChildren: boolean; // becomes a group node in xyflow
}

export interface LayoutInputEdge {
  id: string;
  source: string;
  target: string;
}

export interface LayoutResult {
  // Map of node id → position. For nested children the position is local
  // to the parent's coordinate system (xyflow convention).
  positions: Record<string, { x: number; y: number }>;
  // Map of group node id → outer width/height (after ELK has packed
  // children inside).
  sizes: Record<string, { width: number; height: number }>;
}

interface ElkChildNode {
  id: string;
  width?: number;
  height?: number;
  children?: ElkChildNode[];
  layoutOptions?: Record<string, string>;
}

interface ElkEdgeShape {
  id: string;
  sources: string[];
  targets: string[];
}

interface ElkLayoutResult {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkLayoutResult[];
}

function buildElkInput(nodes: LayoutInputNode[], edges: LayoutInputEdge[]) {
  // Build the xyflow tree by parentId. Top-level nodes go directly under
  // the synthetic ELK root; deeper nodes are nested inside their parents.
  const childrenOf = new Map<string | null, LayoutInputNode[]>();
  for (const n of nodes) {
    const arr = childrenOf.get(n.parentId);
    if (arr) arr.push(n);
    else childrenOf.set(n.parentId, [n]);
  }

  function build(parentId: string | null): ElkChildNode[] {
    const kids = childrenOf.get(parentId) ?? [];
    return kids.map((n) => {
      const children = build(n.id);
      const node: ElkChildNode = {
        id: n.id,
      };
      if (children.length > 0) {
        // Group container. Size is computed by ELK based on packed
        // children; we just supply paddings so ELK leaves room for our
        // header (top padding) and the borders (other paddings).
        node.children = children;
        node.layoutOptions = {
          'elk.padding': `[top=${GROUP_PAD_TOP},left=${GROUP_PAD_OTHER},bottom=${GROUP_PAD_OTHER},right=${GROUP_PAD_OTHER}]`,
        };
      } else {
        node.width = NODE_W;
        node.height = NODE_H;
      }
      return node;
    });
  }

  const root: ElkChildNode = {
    id: 'root',
    children: build(null),
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '40',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
  };

  const elkEdges: ElkEdgeShape[] = edges.map((e) => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }));

  return { root, edges: elkEdges };
}

function flatten(out: LayoutResult, n: ElkLayoutResult, parentX = 0, parentY = 0) {
  // ELK returns coordinates in the *parent's* local frame already, so we
  // store positions verbatim. For sizes we record only group nodes (those
  // with children), since leaves keep the static NODE_W × NODE_H.
  if (n.id !== 'root') {
    out.positions[n.id] = { x: n.x ?? 0, y: n.y ?? 0 };
    if (n.children && n.children.length > 0) {
      out.sizes[n.id] = {
        width: n.width ?? NODE_W,
        height: n.height ?? NODE_H,
      };
    }
  }
  for (const c of n.children ?? []) flatten(out, c, (parentX + (n.x ?? 0)), (parentY + (n.y ?? 0)));
}

export interface ApplyLayoutInput {
  nodes: Node[];
  manualPositions: Record<string, { x: number; y: number }>;
}

export interface ApplyLayoutResult {
  nodes: Node[];
}

// Apply a `LayoutResult` to xyflow nodes:
//  - if the node has a manual position, use that
//  - otherwise use the ELK position
//  - for group nodes, set width/height so xyflow renders the container
export function applyLayout(
  layoutNodes: Node[],
  layout: LayoutResult,
  manual: Record<string, { x: number; y: number }>,
): Node[] {
  return layoutNodes.map((n) => {
    const pos = manual[n.id] ?? layout.positions[n.id] ?? n.position ?? { x: 0, y: 0 };
    const size = layout.sizes[n.id];
    if (size) {
      return {
        ...n,
        position: pos,
        style: { ...(n.style ?? {}), width: size.width, height: size.height },
      };
    }
    return { ...n, position: pos };
  });
}

// React hook: re-runs ELK whenever the (nodes, edges) signature changes.
// `signature` is a string the caller computes from whatever it considers
// layout-relevant (typically: the set of visible node ids + the edge set).
// Returns the latest layout, or null while the first run is still pending.
export function useGraphLayout(
  inputNodes: LayoutInputNode[],
  inputEdges: LayoutInputEdge[],
  signature: string,
): LayoutResult | null {
  const [result, setResult] = useState<LayoutResult | null>(null);
  const lastSignatureRef = useRef<string>('');

  useEffect(() => {
    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;
    let cancelled = false;
    const { root, edges } = buildElkInput(inputNodes, inputEdges);
    // ELK's TS types are loose around the root graph shape; cast through
    // `unknown` so we can pass our `ElkChildNode`-flavoured root + edges
    // without elkjs's stricter typings rejecting the literal.
    const elkInput = { ...(root as object), edges } as unknown;
    void elk
      .layout(elkInput as Parameters<typeof elk.layout>[0])
      .then((laid) => {
        if (cancelled) return;
        const out: LayoutResult = { positions: {}, sizes: {} };
        flatten(out, laid as unknown as ElkLayoutResult);
        setResult(out);
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn('ELK layout failed', err);
      });
    return () => { cancelled = true; };
  }, [signature, inputNodes, inputEdges]);

  return result;
}

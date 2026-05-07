import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import {
  layoutGrid,
  LEAF_W,
  LEAF_H,
  type GridLayoutInputNode,
  type LayoutResult,
  type LayoutOrientation,
} from '../lib/layout-grid';

// Lane-grid layout. Replaces ELK's INCLUDE_CHILDREN nesting (which packed
// every parent's children into a single tall box regardless of count) with
// an alternating-direction recursive grid:
//
//   - depth 0 → horizontal lane (root assets side-by-side)
//   - depth 1 → vertical lane
//   - depth 2 → horizontal lane
//   - ...
//
// Each Asset carries a `layoutOrientation` (AUTO | HORIZONTAL | VERTICAL).
// AUTO follows the depth rule; the override applies only to that node's
// own children direction (no propagation). Children sort within their
// parent's lane by `layoutOrder` (Float, bisectable on insert).
//
// Positions are deterministic from (parentId, layoutOrder, layoutOrientation,
// collapsed); there are no DB-stored or localStorage-stored x/y. The drag
// interaction snaps to slot-or-reparent and PATCHes layoutOrder/parentId
// instead of remembering pixel offsets.

export interface LayoutInputNode {
  id: string;
  parentId: string | null;
  hasChildren: boolean;
  layoutOrder: number;
  layoutOrientation: LayoutOrientation;
  collapsed?: boolean;
}

// Edges are no longer used by the layout engine itself (the grid is
// determined by the asset tree, not the relationship edges). Kept on the
// hook signature so callers don't have to thread a different signature.
export interface LayoutInputEdge {
  id: string;
  source: string;
  target: string;
}

export type { LayoutResult };

// Apply a `LayoutResult` to xyflow nodes:
//   - position from layout, no manual fallback (positions are derived)
//   - groups get an explicit width/height; leaves keep their CSS footprint
export function applyLayout(layoutNodes: Node[], layout: LayoutResult): Node[] {
  return layoutNodes.map((n) => {
    const pos = layout.positions[n.id] ?? n.position ?? { x: 0, y: 0 };
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

export { LEAF_W, LEAF_H };

// React hook: synchronous grid layout. The tree is small (hundreds of
// nodes max), so we run inline inside `useMemo` keyed on a signature the
// caller supplies (typically: visible-node ids + parent + order +
// orientation + collapsed). No async, no Promise.
//
// `_inputEdges` is accepted for signature parity with the previous ELK
// implementation; it doesn't affect node positions any more.
export function useGraphLayout(
  inputNodes: LayoutInputNode[],
  _inputEdges: LayoutInputEdge[],
  signature: string,
): LayoutResult {
  return useMemo(() => {
    const grid: GridLayoutInputNode[] = inputNodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      hasChildren: n.hasChildren,
      layoutOrder: n.layoutOrder,
      layoutOrientation: n.layoutOrientation,
      collapsed: n.collapsed,
    }));
    return layoutGrid(grid);
    // signature captures everything the caller considers layout-relevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

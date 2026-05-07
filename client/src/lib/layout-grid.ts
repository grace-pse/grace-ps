// Lane-grid layout for the relationships canvas.
//
// Replaces ELK's INCLUDE_CHILDREN nesting (which produced tall vertical
// boxes for every multi-child container) with an alternating-direction
// recursive layout:
//   - depth 0 children flow horizontally
//   - depth 1 children flow vertically
//   - depth 2 children flow horizontally
//   - ...
// Each node carries a `layoutOrientation` of AUTO | HORIZONTAL | VERTICAL.
// AUTO follows the depth rule; the others override that node's children
// direction without affecting descendants' depth count.
//
// Position output is in the xyflow nesting convention: child positions
// are local to the parent's top-left, group sizes are absolute.

export type LayoutOrientation = 'AUTO' | 'HORIZONTAL' | 'VERTICAL';

export interface GridLayoutInputNode {
  id: string;
  parentId: string | null;
  hasChildren: boolean; // becomes a group node in xyflow
  layoutOrder: number;
  layoutOrientation: LayoutOrientation;
  collapsed?: boolean;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  sizes: Record<string, { width: number; height: number }>;
}

// Sizing — kept in step with the AssetNode CSS (240×72) so a leaf
// rendered without an explicit style still has the right footprint.
export const LEAF_W = 240;
export const LEAF_H = 72;
const HEADER = 52;       // group header strip + breathing room
const PAD = 20;          // inside-edge padding in a group container
const GAP_H = 40;        // gap between siblings in a HORIZONTAL lane
const GAP_V = 24;        // gap between siblings in a VERTICAL lane
const COLLAPSED_W = 280; // collapsed group footprint
const COLLAPSED_H = 44;
const EMPTY_W = 240;     // empty group footprint
const EMPTY_H = HEADER + PAD;

interface Box { width: number; height: number }

function effectiveOrientation(
  node: GridLayoutInputNode,
  depth: number,
): 'HORIZONTAL' | 'VERTICAL' {
  if (node.layoutOrientation !== 'AUTO') return node.layoutOrientation;
  return depth % 2 === 0 ? 'HORIZONTAL' : 'VERTICAL';
}

export function layoutGrid(nodes: GridLayoutInputNode[]): LayoutResult {
  const positions: LayoutResult['positions'] = {};
  const sizes: LayoutResult['sizes'] = {};

  // Bucket children by parentId, sort each bucket by layoutOrder.
  const byParent = new Map<string | null, GridLayoutInputNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId);
    if (arr) arr.push(n);
    else byParent.set(n.parentId, [n]);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.layoutOrder - b.layoutOrder || a.id.localeCompare(b.id));
  }

  // Recursive: place a node's children inside it, return the node's own
  // box so the parent caller can position siblings.
  function place(node: GridLayoutInputNode, depth: number): Box {
    if (!node.hasChildren) {
      return { width: LEAF_W, height: LEAF_H };
    }
    if (node.collapsed) {
      return { width: COLLAPSED_W, height: COLLAPSED_H };
    }
    const kids = byParent.get(node.id) ?? [];
    if (kids.length === 0) {
      return { width: EMPTY_W, height: EMPTY_H };
    }

    const dir = effectiveOrientation(node, depth);
    const kidBoxes = kids.map((k) => place(k, depth + 1));

    if (dir === 'HORIZONTAL') {
      let cursorX = PAD;
      const innerY = HEADER + PAD;
      let maxH = 0;
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        const b = kidBoxes[i];
        positions[k.id] = { x: cursorX, y: innerY };
        if (b.width > 0 && b.height > 0) sizes[k.id] = { width: b.width, height: b.height };
        cursorX += b.width + GAP_H;
        if (b.height > maxH) maxH = b.height;
      }
      const totalW = cursorX - GAP_H + PAD; // remove trailing gap, add right pad
      const totalH = HEADER + PAD + maxH + PAD;
      return { width: totalW, height: totalH };
    } else {
      const innerX = PAD;
      let cursorY = HEADER + PAD;
      let maxW = 0;
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i];
        const b = kidBoxes[i];
        positions[k.id] = { x: innerX, y: cursorY };
        if (b.width > 0 && b.height > 0) sizes[k.id] = { width: b.width, height: b.height };
        cursorY += b.height + GAP_V;
        if (b.width > maxW) maxW = b.width;
      }
      const totalH = cursorY - GAP_V + PAD;
      const totalW = PAD + maxW + PAD;
      return { width: totalW, height: totalH };
    }
  }

  // Top-level lane: roots laid out horizontally with a generous gap.
  // Conceptually depth = -1 for the synthetic canvas root, so depth 0
  // is HORIZONTAL via the parity rule.
  const roots = byParent.get(null) ?? [];
  const ROOT_GAP_H = 80;
  let cursorX = 0;
  for (const r of roots) {
    const b = place(r, 0);
    positions[r.id] = { x: cursorX, y: 0 };
    if (b.width > 0 && b.height > 0) sizes[r.id] = { width: b.width, height: b.height };
    cursorX += b.width + ROOT_GAP_H;
  }

  return { positions, sizes };
}

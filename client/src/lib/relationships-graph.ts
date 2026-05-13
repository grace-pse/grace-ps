import type { AssetGraphNode, AssetRelationshipSummary } from './csmp-types';

// Shared helpers for the parentId tree on the asset graph. Used by both
// the node-link diagram (RelationshipsPage) and the coverage matrix
// (CoverageMatrixPage) so isolation logic stays identical between lenses.

export function buildChildrenMap(nodes: AssetGraphNode[]): Map<string, string[]> {
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

export function descendantsOf(rootId: string, childrenMap: Map<string, string[]>): Set<string> {
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

// 1-hop neighbors of a subtree: every node connected to the subtree by at
// least one relationship edge but not itself in the subtree. Used by the
// graph isolate to render context nodes dimmed alongside the focus subtree.
export function oneHopNeighbors(
  subtree: ReadonlySet<string>,
  edges: ReadonlyArray<AssetRelationshipSummary>,
): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    const sIn = subtree.has(e.sourceAssetId);
    const tIn = subtree.has(e.targetAssetId);
    if (sIn && !tIn) out.add(e.targetAssetId);
    else if (tIn && !sIn) out.add(e.sourceAssetId);
  }
  return out;
}

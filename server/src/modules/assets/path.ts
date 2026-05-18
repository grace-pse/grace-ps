import { Prisma, type PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

const MAX_DEPTH = 64;

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'asset';
}

export interface NextSegmentArgs {
  parentId: string | null;
  baseSlug: string;
  excludeId?: string;
}

export async function nextAvailableSegment(
  tx: Tx,
  { parentId, baseSlug, excludeId }: NextSegmentArgs,
): Promise<string> {
  for (let i = 1; i < 1_000; i++) {
    const candidate = i === 1 ? baseSlug : `${baseSlug}-${i}`;
    const clash = await tx.asset.findFirst({
      where: {
        parentId,
        pathSegment: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error(`nextAvailableSegment: too many sibling collisions for "${baseSlug}"`);
}

// Walk the subtree rooted at `rootId` (inclusive) and rewrite each node's
// `path` to `parent.path ? `${parent.path}/${segment}` : segment`. Uses BFS
// so each row's parent is updated before its children. Path segments are
// preserved — caller should have set the root's segment if it changed.
export async function recomputeSubtreePath(
  tx: Tx,
  rootId: string,
): Promise<void> {
  const root = await tx.asset.findUnique({
    where: { id: rootId },
    select: { id: true, parentId: true, pathSegment: true },
  });
  if (!root) return;

  let parentPath = '';
  if (root.parentId) {
    const parent = await tx.asset.findUnique({
      where: { id: root.parentId },
      select: { path: true },
    });
    parentPath = parent?.path ?? '';
  }
  const rootPath = parentPath ? `${parentPath}/${root.pathSegment}` : root.pathSegment;

  await tx.asset.update({
    where: { id: rootId },
    data: { path: rootPath },
  });

  const queue: Array<{ id: string; path: string; depth: number }> = [
    { id: rootId, path: rootPath, depth: 0 },
  ];
  while (queue.length) {
    const node = queue.shift()!;
    if (node.depth > MAX_DEPTH) {
      throw new Error('recomputeSubtreePath: max depth exceeded');
    }
    const children = await tx.asset.findMany({
      where: { parentId: node.id },
      select: { id: true, pathSegment: true },
    });
    for (const c of children) {
      const cp = `${node.path}/${c.pathSegment}`;
      await tx.asset.update({ where: { id: c.id }, data: { path: cp } });
      queue.push({ id: c.id, path: cp, depth: node.depth + 1 });
    }
  }
}

// BFS over the subtree rooted at `rootId`. For each node, picks a fresh
// `pathSegment` via nextAvailableSegment(slugify(name)) and writes the
// matching `path`. Used after cloneAssetTree, where children were created
// with placeholder segments to satisfy the partial unique index.
export async function assignPathsForSubtree(
  tx: Tx,
  rootId: string,
): Promise<void> {
  const queue: string[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const node = await tx.asset.findUnique({
      where: { id },
      select: { id: true, name: true, parentId: true },
    });
    if (!node) continue;

    let parentPath = '';
    if (node.parentId) {
      const parent = await tx.asset.findUnique({
        where: { id: node.parentId },
        select: { path: true },
      });
      parentPath = parent?.path ?? '';
    }
    const segment = await nextAvailableSegment(tx, {
      parentId: node.parentId,
      baseSlug: slugify(node.name),
      excludeId: id,
    });
    const path = parentPath ? `${parentPath}/${segment}` : segment;
    await tx.asset.update({
      where: { id },
      data: { pathSegment: segment, path },
    });

    const children = await tx.asset.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    for (const c of children) queue.push(c.id);
  }
}

// MQTT topic match → SQL predicate. Returns Prisma.Sql ready to AND into a
// $queryRaw / Prisma.sql template.
//
//   "site-a/bldg-1"     → path LIKE 'site-a/bldg-1%'   (prefix match)
//   "site-a/+/server"   → path ~ '^site-a/[^/]+/server$'
//   "site-a/#"          → path ~ '^site-a(/.*)?$'  (the # matches the
//                          remainder, including zero segments)
//   "site-a/bldg-1/"    → path LIKE 'site-a/bldg-1/%' (subtree-only)
//
// Throws on invalid patterns (mid-path '#', double-slash, …) — caller maps
// to a 400.
export class InvalidPathPattern extends Error {}

export function buildPathPredicate(pattern: string): Prisma.Sql {
  const trimmed = pattern.trim();
  if (!trimmed) throw new InvalidPathPattern('empty path pattern');

  if (trimmed.includes('//')) {
    throw new InvalidPathPattern('path pattern contains empty segment');
  }

  const hasPlus = trimmed.includes('+');
  const hasHash = trimmed.includes('#');

  if (hasHash) {
    const segs = trimmed.split('/');
    for (let i = 0; i < segs.length - 1; i++) {
      if ((segs[i] ?? '').includes('#')) {
        throw new InvalidPathPattern("'#' wildcard is only allowed as the final segment");
      }
    }
    if (segs[segs.length - 1] !== '#') {
      throw new InvalidPathPattern("'#' must occupy a whole segment");
    }
  }

  if (!hasPlus && !hasHash) {
    const trailing = trimmed.endsWith('/');
    const literal = trailing ? trimmed : trimmed;
    return Prisma.sql`path LIKE ${escapeLike(literal) + '%'}`;
  }

  // Build a regex. Escape non-wildcard segments, then substitute wildcards.
  const segs = trimmed.split('/');
  const parts: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] ?? '';
    if (s === '+') {
      parts.push('[^/]+');
    } else if (s === '#') {
      parts.push('(.*)?');
    } else {
      if (s.includes('+') || s.includes('#')) {
        throw new InvalidPathPattern("'+' / '#' must occupy a whole segment");
      }
      parts.push(escapeRegex(s));
    }
    if (i < segs.length - 1) parts.push('/');
  }

  // Special-case '<prefix>/#' so it matches '<prefix>' and '<prefix>/<rest>'.
  let regex = parts.join('');
  if (hasHash) {
    // Pattern currently ends with '/(.*)?'. Fold the slash into the optional
    // group so the prefix itself matches.
    regex = regex.replace(/\/\(\.\*\)\?$/, '(/.*)?');
    if (regex === '(.*)?') regex = '.*';
  }
  return Prisma.sql`path ~ ${'^' + regex + '$'}`;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

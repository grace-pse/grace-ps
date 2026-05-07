import type { Prisma } from '@prisma/client';

const MAX_DEPTH = 20;

export interface CloneAssetTreeArgs {
  sourceId: string;
  tenantId: string;
  createdById: string;
  newParentId: string | null;
  nameOverride?: string;
  depth?: number;
}

export interface CloneAssetTreeResult {
  rootId: string;
  idMap: Map<string, string>;
}

export async function cloneAssetTree(
  tx: Prisma.TransactionClient,
  args: CloneAssetTreeArgs,
): Promise<CloneAssetTreeResult> {
  const idMap = new Map<string, string>();
  const rootId = await cloneNode(tx, args, idMap);
  return { rootId, idMap };
}

async function cloneNode(
  tx: Prisma.TransactionClient,
  args: CloneAssetTreeArgs,
  idMap: Map<string, string>,
): Promise<string> {
  const depth = args.depth ?? 0;
  if (depth > MAX_DEPTH) {
    throw new Error(`cloneAssetTree exceeded max depth (${MAX_DEPTH})`);
  }

  const source = await tx.asset.findFirst({
    where: { id: args.sourceId, tenantId: args.tenantId },
  });
  if (!source) {
    throw new Error(`cloneAssetTree: source asset ${args.sourceId} not found`);
  }

  // Use a placeholder unique pathSegment per row to satisfy the
  // (tenant_id, parent_id, path_segment) partial unique index. The caller
  // recomputes the real segments + paths via recomputeSubtreePath after the
  // clone tree is built.
  const placeholderSegment = `__cloning__${args.sourceId}__${depth}__${Math.random().toString(36).slice(2, 10)}`;

  const created = await tx.asset.create({
    data: {
      tenantId: args.tenantId,
      createdById: args.createdById,
      parentId: args.newParentId,
      name: args.nameOverride ?? source.name,
      assetType: source.assetType,
      category: source.category,
      description: source.description,
      criticality: source.criticality,
      status: source.status,
      location: (source.location ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: (source.metadata ?? {}) as Prisma.InputJsonValue,
      tags: source.tags,
      sourceTemplateId: source.sourceTemplateId,
      pathSegment: placeholderSegment,
      path: placeholderSegment,
    },
  });

  idMap.set(source.id, created.id);

  const children = await tx.asset.findMany({
    where: { parentId: source.id, tenantId: args.tenantId },
    select: { id: true },
  });

  for (const child of children) {
    await cloneNode(
      tx,
      {
        sourceId: child.id,
        tenantId: args.tenantId,
        createdById: args.createdById,
        newParentId: created.id,
        depth: depth + 1,
      },
      idMap,
    );
  }

  return created.id;
}

export async function copyInternalRelationships(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; idMap: Map<string, string> },
): Promise<number> {
  const ids = [...args.idMap.keys()];
  if (ids.length === 0) return 0;

  const internal = await tx.assetRelationship.findMany({
    where: {
      tenantId: args.tenantId,
      sourceAssetId: { in: ids },
      targetAssetId: { in: ids },
    },
  });
  if (internal.length === 0) return 0;

  await tx.assetRelationship.createMany({
    data: internal.map((r) => ({
      tenantId: args.tenantId,
      sourceAssetId: args.idMap.get(r.sourceAssetId)!,
      targetAssetId: args.idMap.get(r.targetAssetId)!,
      relationshipType: r.relationshipType,
      direction: r.direction,
      impactPropagation: r.impactPropagation,
      description: r.description,
    })),
  });

  return internal.length;
}

import type { Prisma } from '@prisma/client';

const MAX_DEPTH = 20;

async function nextLayoutOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
  parentId: string | null,
): Promise<number> {
  const last = await tx.asset.findFirst({
    where: { tenantId, parentId },
    orderBy: { layoutOrder: 'desc' },
    select: { layoutOrder: true },
  });
  return (last?.layoutOrder ?? 0) + 1;
}

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
      layoutOrientation: source.layoutOrientation,
      // Place clone at end of new parent's lane so it doesn't overlap.
      layoutOrder: await nextLayoutOrder(tx, args.tenantId, args.newParentId ?? null),
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

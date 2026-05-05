import type { AssetType, OperationalStatus, PrismaClient } from '@prisma/client';
import { PROTECTIVE_REL_TYPES } from './propagate-asset-risk.js';

export type ProtectiveCoverageItem = {
  protectiveAssetId: string;
  name: string;
  assetType: AssetType;
  criticality: number;
  source: 'EDGE' | 'IMPLICIT_LOCATION';
  relationshipType: 'PROTECTS' | 'MONITORS' | null;
  operationalStatus: OperationalStatus;
  degradedSince: string | null;
};

export async function getProtectiveCoverageForAsset(
  prisma: PrismaClient,
  tenantId: string,
  assetId: string,
): Promise<ProtectiveCoverageItem[]> {
  const edges = await prisma.assetRelationship.findMany({
    where: {
      tenantId,
      relationshipType: { in: [...PROTECTIVE_REL_TYPES] },
      OR: [
        { targetAssetId: assetId },
        { sourceAssetId: assetId, direction: 'BIDIRECTIONAL' },
      ],
    },
    select: {
      relationshipType: true,
      sourceAssetId: true,
      targetAssetId: true,
      direction: true,
      sourceAsset: {
        select: {
          id: true, name: true, assetType: true, criticality: true,
          operationalStatus: true, degradedControlSince: true,
        },
      },
      targetAsset: {
        select: {
          id: true, name: true, assetType: true, criticality: true,
          operationalStatus: true, degradedControlSince: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  const items: ProtectiveCoverageItem[] = [];

  for (const e of edges) {
    const protective = e.sourceAssetId === assetId ? e.targetAsset : e.sourceAsset;
    if (seen.has(protective.id)) continue;
    seen.add(protective.id);
    items.push({
      protectiveAssetId: protective.id,
      name: protective.name,
      assetType: protective.assetType,
      criticality: protective.criticality,
      source: 'EDGE',
      relationshipType: e.relationshipType as 'PROTECTS' | 'MONITORS',
      operationalStatus: protective.operationalStatus,
      degradedSince: protective.degradedControlSince
        ? protective.degradedControlSince.toISOString()
        : null,
    });
  }

  let frontier: string[] = [assetId];
  const subtree = new Set<string>();
  while (frontier.length > 0) {
    const children = await prisma.asset.findMany({
      where: { tenantId, parentId: { in: frontier } },
      select: { id: true },
    });
    const next: string[] = [];
    for (const c of children) {
      if (!subtree.has(c.id)) {
        subtree.add(c.id);
        next.push(c.id);
      }
    }
    frontier = next;
  }
  if (subtree.size > 0) {
    const implicit = await prisma.asset.findMany({
      where: {
        tenantId,
        id: { in: [...subtree], notIn: [...seen] },
        assetRole: { in: ['PROTECTIVE', 'DUAL'] },
      },
      select: {
        id: true, name: true, assetType: true, criticality: true,
        operationalStatus: true, degradedControlSince: true,
      },
      orderBy: [{ name: 'asc' }],
    });
    for (const a of implicit) {
      items.push({
        protectiveAssetId: a.id,
        name: a.name,
        assetType: a.assetType,
        criticality: a.criticality,
        source: 'IMPLICIT_LOCATION',
        relationshipType: null,
        operationalStatus: a.operationalStatus,
        degradedSince: a.degradedControlSince
          ? a.degradedControlSince.toISOString()
          : null,
      });
    }
  }

  return items;
}

export async function getProtectiveCoverageForAssessment(
  prisma: PrismaClient,
  tenantId: string,
  assessment: { assetId: string | null; clusterId: string | null },
): Promise<ProtectiveCoverageItem[]> {
  if (assessment.assetId) {
    return getProtectiveCoverageForAsset(prisma, tenantId, assessment.assetId);
  }
  if (assessment.clusterId) {
    const memberships = await prisma.assetClusterMembership.findMany({
      where: { clusterId: assessment.clusterId },
      select: { assetId: true },
    });
    const seen = new Set<string>();
    const merged: ProtectiveCoverageItem[] = [];
    for (const m of memberships) {
      const sub = await getProtectiveCoverageForAsset(prisma, tenantId, m.assetId);
      for (const item of sub) {
        if (seen.has(item.protectiveAssetId)) continue;
        seen.add(item.protectiveAssetId);
        merged.push(item);
      }
    }
    return merged;
  }
  return [];
}

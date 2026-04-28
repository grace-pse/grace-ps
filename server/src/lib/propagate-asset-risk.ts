import { OperationalStatus, Prisma } from '@prisma/client';

export type StatusTransition = {
  from: OperationalStatus;
  to: OperationalStatus;
};

export const PROTECTIVE_REL_TYPES = ['PROTECTS', 'MONITORS'] as const;

// Pure rule: any incoming protective edge whose source is non-OPERATIONAL
// flips the target into degraded posture. Single edit site for future
// weighting / redundancy logic.
export function computeDegradedPosture(
  edges: Array<{ sourceStatus: OperationalStatus }>,
): boolean {
  return edges.some((e) => e.sourceStatus !== 'OPERATIONAL');
}

// Walks outgoing PROTECTS / MONITORS edges from `sourceAssetId` (depth = 1)
// and recomputes `degradedControlPosture` on every directly-reached target.
// Bidirectional edges where the changed asset is the *target* are also
// considered, since the edge semantically protects in both directions.
//
// DUAL note: depth-1 cap means a DUAL whose own protector failed will get
// flagged, but assets the DUAL itself protects do NOT cascade further. This
// matches the research note's deferred-redundancy decision; revisit here when
// transitive cascade is needed.
export async function propagateAssetRisk(
  tx: Prisma.TransactionClient,
  tenantId: string,
  sourceAssetId: string,
  _transition: StatusTransition,
): Promise<{ flaggedIds: string[]; clearedIds: string[] }> {
  // 1. Find directly affected targets — outgoing edges (this asset protects them)
  //    plus bidirectional edges where this asset is on the target side.
  const outgoing = await tx.assetRelationship.findMany({
    where: {
      tenantId,
      relationshipType: { in: [...PROTECTIVE_REL_TYPES] },
      OR: [
        { sourceAssetId },
        { targetAssetId: sourceAssetId, direction: 'BIDIRECTIONAL' },
      ],
    },
    select: { sourceAssetId: true, targetAssetId: true },
  });

  const affectedTargetIds = new Set<string>();
  for (const edge of outgoing) {
    const otherEnd =
      edge.sourceAssetId === sourceAssetId ? edge.targetAssetId : edge.sourceAssetId;
    affectedTargetIds.add(otherEnd);
  }

  if (affectedTargetIds.size === 0) {
    return { flaggedIds: [], clearedIds: [] };
  }

  // 2. For each affected target, re-read ALL its incoming protective edges
  //    (not just from the changed asset) and recompute the flag.
  const incoming = await tx.assetRelationship.findMany({
    where: {
      tenantId,
      relationshipType: { in: [...PROTECTIVE_REL_TYPES] },
      OR: [
        { targetAssetId: { in: [...affectedTargetIds] } },
        {
          sourceAssetId: { in: [...affectedTargetIds] },
          direction: 'BIDIRECTIONAL',
        },
      ],
    },
    select: {
      sourceAssetId: true,
      targetAssetId: true,
      direction: true,
      sourceAsset: { select: { id: true, operationalStatus: true } },
      targetAsset: { select: { id: true, operationalStatus: true } },
    },
  });

  const edgesByTarget = new Map<string, Array<{ sourceStatus: OperationalStatus }>>();
  for (const targetId of affectedTargetIds) {
    edgesByTarget.set(targetId, []);
  }
  for (const edge of incoming) {
    if (affectedTargetIds.has(edge.targetAssetId)) {
      edgesByTarget.get(edge.targetAssetId)!.push({
        sourceStatus: edge.sourceAsset.operationalStatus,
      });
    }
    if (edge.direction === 'BIDIRECTIONAL' && affectedTargetIds.has(edge.sourceAssetId)) {
      edgesByTarget.get(edge.sourceAssetId)!.push({
        sourceStatus: edge.targetAsset.operationalStatus,
      });
    }
  }

  // 3. Read current flag state to compute diffs (avoid pointless writes).
  const current = await tx.asset.findMany({
    where: { tenantId, id: { in: [...affectedTargetIds] } },
    select: { id: true, degradedControlPosture: true },
  });
  const currentFlag = new Map(current.map((a) => [a.id, a.degradedControlPosture]));

  const toFlag: string[] = [];
  const toClear: string[] = [];
  for (const [targetId, edges] of edgesByTarget) {
    const desired = computeDegradedPosture(edges);
    const current = currentFlag.get(targetId) ?? false;
    if (desired && !current) toFlag.push(targetId);
    else if (!desired && current) toClear.push(targetId);
  }

  if (toFlag.length > 0) {
    await tx.asset.updateMany({
      where: { tenantId, id: { in: toFlag } },
      data: {
        degradedControlPosture: true,
        degradedControlSince: new Date(),
      },
    });
  }
  if (toClear.length > 0) {
    await tx.asset.updateMany({
      where: { tenantId, id: { in: toClear } },
      data: {
        degradedControlPosture: false,
        degradedControlSince: null,
      },
    });
  }

  return { flaggedIds: toFlag, clearedIds: toClear };
}

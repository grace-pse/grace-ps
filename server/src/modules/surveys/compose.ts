// Auto-compose a ClusterSurveyScope from a cluster's AAA tuples.
//
// Walks the cluster's assets, the threats targeting those assets (across all
// assessments scoped to the cluster or any of its assets), and the
// countermeasures assigned to those assets/threats. For each AAA item we
// look up the linked SurveyQuestion rows on its source template (if any),
// filter by the scope's `evidenceTypes`, and emit ScopeItem rows.
//
// Aggregation:
//  - AGGREGATE_BY_CM_TEMPLATE: countermeasures sharing a sourceTemplateId
//    collapse to one COUNTERMEASURE_GROUP item per (template, question).
//  - PER_INSTANCE: one COUNTERMEASURE item per (countermeasure, question).
// Countermeasures without sourceTemplateId always fall through to PER_INSTANCE
// (we can't aggregate without a template handle).
//
// This produces the seed list — the operator then curates: add MANUAL items,
// remove auto-included items, override weights, before approving.

import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type ScopeItemSource = 'ASSET' | 'THREAT' | 'COUNTERMEASURE' | 'COUNTERMEASURE_GROUP' | 'MANUAL';
export type AggregationMode = 'AGGREGATE_BY_CM_TEMPLATE' | 'PER_INSTANCE';
export type EvidenceType = 'PHYSICAL' | 'REMOTE_TECH' | 'DOC_REVIEW' | 'HYBRID' | 'CUSTOM';

export interface ComposedItem {
  questionId: string;
  sourceType: ScopeItemSource;
  sourceAssetId: string | null;
  sourceThreatId: string | null;
  sourceCountermeasureId: string | null;
  sourceCountermeasureTemplateId: string | null;
  weightOverride: number | null;
  sortOrder: number;
}

export interface ComposeOptions {
  tenantId: string;
  clusterId: string;
  evidenceTypes: EvidenceType[];
  aggregationMode: AggregationMode;
}

export async function composeScopeItems(opts: ComposeOptions): Promise<ComposedItem[]> {
  const { tenantId, clusterId, evidenceTypes, aggregationMode } = opts;

  const cluster = await prisma.assetCluster.findFirst({
    where: { id: clusterId, tenantId },
    include: { memberships: true },
  });
  if (!cluster) return [];

  const assetIds = cluster.memberships.map((m) => m.assetId);
  if (assetIds.length === 0) return [];

  // Asset templates → question links.
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, tenantId },
    select: { id: true, sourceTemplateId: true },
  });

  const assetTemplateIds = Array.from(
    new Set(assets.map((a) => a.sourceTemplateId).filter((id): id is string => id != null)),
  );

  const assetTemplateLinks = assetTemplateIds.length
    ? await prisma.assetTemplateQuestion.findMany({
        where: {
          assetTemplateId: { in: assetTemplateIds },
          question: { isActive: true, evidenceType: { in: evidenceTypes }, OR: [{ tenantId: null }, { tenantId }] },
        },
      })
    : [];

  const assetLinksByTemplate = new Map<string, typeof assetTemplateLinks>();
  for (const l of assetTemplateLinks) {
    const arr = assetLinksByTemplate.get(l.assetTemplateId) ?? [];
    arr.push(l);
    assetLinksByTemplate.set(l.assetTemplateId, arr);
  }

  // Threats targeting any asset in scope (any assessment).
  const threats = await prisma.threat.findMany({
    where: { targetAssetId: { in: assetIds } },
    select: {
      id: true,
      targetAssetId: true,
      dbtReference: { select: { sourceTemplateId: true } },
    },
  });

  const threatTemplateIds = Array.from(
    new Set(
      threats.map((t) => t.dbtReference?.sourceTemplateId).filter((id): id is string => id != null),
    ),
  );

  const threatTemplateLinks = threatTemplateIds.length
    ? await prisma.threatTemplateQuestion.findMany({
        where: {
          threatTemplateId: { in: threatTemplateIds },
          question: { isActive: true, evidenceType: { in: evidenceTypes }, OR: [{ tenantId: null }, { tenantId }] },
        },
      })
    : [];

  const threatLinksByTemplate = new Map<string, typeof threatTemplateLinks>();
  for (const l of threatTemplateLinks) {
    const arr = threatLinksByTemplate.get(l.threatTemplateId) ?? [];
    arr.push(l);
    threatLinksByTemplate.set(l.threatTemplateId, arr);
  }

  // Countermeasures assigned to scoped assets (or to threats targeting them).
  // Build the OR array conditionally — passing a string sentinel as the `id`
  // (an earlier shape did this with '__never__') makes Prisma try to coerce
  // it to UUID and explode with P2023 on the whole compose query.
  const threatIds = threats.map((t) => t.id);
  const cmOrClauses: Prisma.CountermeasureWhereInput[] = [
    { assignedToAssetId: { in: assetIds } },
  ];
  if (threatIds.length > 0) {
    cmOrClauses.push({ assignedToThreatId: { in: threatIds } });
  }
  const countermeasures = await prisma.countermeasure.findMany({
    where: { tenantId, OR: cmOrClauses },
    select: { id: true, sourceTemplateId: true, assignedToAssetId: true, assignedToThreatId: true },
  });

  const cmTemplateIds = Array.from(
    new Set(countermeasures.map((c) => c.sourceTemplateId).filter((id): id is string => id != null)),
  );

  const cmTemplateLinks = cmTemplateIds.length
    ? await prisma.countermeasureTemplateQuestion.findMany({
        where: {
          countermeasureTemplateId: { in: cmTemplateIds },
          question: { isActive: true, evidenceType: { in: evidenceTypes }, OR: [{ tenantId: null }, { tenantId }] },
        },
      })
    : [];

  const cmLinksByTemplate = new Map<string, typeof cmTemplateLinks>();
  for (const l of cmTemplateLinks) {
    const arr = cmLinksByTemplate.get(l.countermeasureTemplateId) ?? [];
    arr.push(l);
    cmLinksByTemplate.set(l.countermeasureTemplateId, arr);
  }

  const items: ComposedItem[] = [];
  let order = 0;

  // Asset items.
  for (const a of assets) {
    if (!a.sourceTemplateId) continue;
    const links = assetLinksByTemplate.get(a.sourceTemplateId) ?? [];
    for (const l of links) {
      items.push({
        questionId: l.questionId,
        sourceType: 'ASSET',
        sourceAssetId: a.id,
        sourceThreatId: null,
        sourceCountermeasureId: null,
        sourceCountermeasureTemplateId: null,
        weightOverride: l.weight,
        sortOrder: order++,
      });
    }
  }

  // Threat items.
  for (const t of threats) {
    const tplId = t.dbtReference?.sourceTemplateId;
    if (!tplId) continue;
    const links = threatLinksByTemplate.get(tplId) ?? [];
    for (const l of links) {
      items.push({
        questionId: l.questionId,
        sourceType: 'THREAT',
        sourceAssetId: null,
        sourceThreatId: t.id,
        sourceCountermeasureId: null,
        sourceCountermeasureTemplateId: null,
        weightOverride: l.weight,
        sortOrder: order++,
      });
    }
  }

  // Countermeasure items, with aggregation.
  if (aggregationMode === 'AGGREGATE_BY_CM_TEMPLATE') {
    // For CMs with a template: one item per (template, question).
    const seenTemplates = new Set<string>();
    for (const c of countermeasures) {
      if (!c.sourceTemplateId || seenTemplates.has(c.sourceTemplateId)) continue;
      seenTemplates.add(c.sourceTemplateId);
      const links = cmLinksByTemplate.get(c.sourceTemplateId) ?? [];
      for (const l of links) {
        items.push({
          questionId: l.questionId,
          sourceType: 'COUNTERMEASURE_GROUP',
          sourceAssetId: null,
          sourceThreatId: null,
          sourceCountermeasureId: null,
          sourceCountermeasureTemplateId: c.sourceTemplateId,
          weightOverride: l.weight,
          sortOrder: order++,
        });
      }
    }
    // For CMs without a template: per-instance fall-through.
    for (const c of countermeasures) {
      if (c.sourceTemplateId) continue;
      // Without a template we have no questions to attach. Skip silently.
    }
  } else {
    // PER_INSTANCE.
    for (const c of countermeasures) {
      if (!c.sourceTemplateId) continue;
      const links = cmLinksByTemplate.get(c.sourceTemplateId) ?? [];
      for (const l of links) {
        items.push({
          questionId: l.questionId,
          sourceType: 'COUNTERMEASURE',
          sourceAssetId: null,
          sourceThreatId: null,
          sourceCountermeasureId: c.id,
          sourceCountermeasureTemplateId: null,
          weightOverride: l.weight,
          sortOrder: order++,
        });
      }
    }
  }

  return items;
}

// Used by routes to materialise composed items into ClusterSurveyScopeItem rows.
export function composedItemToCreate(
  scopeId: string,
  addedById: string,
  it: ComposedItem,
): Prisma.ClusterSurveyScopeItemUncheckedCreateInput {
  return {
    scopeId,
    questionId: it.questionId,
    sourceType: it.sourceType,
    sourceAssetId: it.sourceAssetId,
    sourceThreatId: it.sourceThreatId,
    sourceCountermeasureId: it.sourceCountermeasureId,
    sourceCountermeasureTemplateId: it.sourceCountermeasureTemplateId,
    weightOverride: it.weightOverride,
    sortOrder: it.sortOrder,
    addedById,
  };
}

import type { IrvBand, TearStrategy, Threat } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { getProtectiveCoverageForAssessment } from '../../../lib/protective-coverage.js';
import { IRV_BANDS } from './constants.js';
import type {
  ChangeLogEntry, ReportCountermeasure, ReportCountermeasureGap,
  ReportData, ReportThreat, ScopeAsset,
} from './types.js';

// Residual IRV derivation (ported from seed-data.js:120-124).
// REDUCE / ELIMINATE → −2 bands; TRANSFER → −1; ACCEPT / null → unchanged.
function deriveResidualIdx(irv: IrvBand | null, tear: TearStrategy | null): number {
  if (!irv) return 0;
  const inherent = IRV_BANDS.indexOf(irv);
  if (inherent < 0) return 0;
  switch (tear) {
    case 'REDUCE':
    case 'ELIMINATE':
      return Math.max(0, inherent - 2);
    case 'TRANSFER':
      return Math.max(0, inherent - 1);
    default:
      return inherent;
  }
}

type ThreatWithIncludes = Threat & {
  targetAsset: { id: string; name: string; assetType: import('@prisma/client').AssetType; criticality: number } | null;
  dbtReference: {
    id: string;
    scenarioName: string;
    csmpUnitReference: string | null;
    typicalActions: string[];
    indicators: string[];
  } | null;
};

function computeThreatFields(t: ThreatWithIncludes): ReportThreat {
  const l = t.likelihoodScore ?? 0;
  const i = t.impactScore ?? 0;
  const irvScore = l * i;
  const residualIdx = deriveResidualIdx(t.irv, t.tearStrategy);
  const residualIrv = IRV_BANDS[residualIdx] ?? 'NEGLIGIBLE';
  return { ...t, irvScore, residualIrvIdx: residualIdx, residualIrv };
}

export class AssessmentNotFoundError extends Error {
  constructor() {
    super('Assessment not found');
    this.name = 'AssessmentNotFoundError';
  }
}

export async function buildReportData(
  assessmentId: string,
  tenantId: string,
): Promise<ReportData> {
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, tenantId },
    include: {
      organization: { select: { name: true } },
      asset: { select: { id: true, name: true, assetType: true, criticality: true } },
      cluster: {
        select: {
          id: true,
          name: true,
          clusterType: true,
          statusPropagation: true,
          memberships: { select: { assetId: true } },
        },
      },
      leadAssessor: { select: { firstName: true, lastName: true, email: true, role: true } },
      reviewedBy: { select: { firstName: true, lastName: true, email: true, role: true } },
      approver: { select: { firstName: true, lastName: true, email: true, role: true } },
      threats: {
        include: {
          targetAsset: { select: { id: true, name: true, assetType: true, criticality: true } },
          dbtReference: {
            select: {
              id: true,
              scenarioName: true,
              csmpUnitReference: true,
              typicalActions: true,
              indicators: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
      actionPlans: { orderBy: [{ createdAt: 'asc' }] },
      recommendations: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      snapshots: {
        orderBy: [{ capturedAt: 'asc' }],
        include: { capturedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!a) throw new AssessmentNotFoundError();

  // Resolve scope assets (direct asset OR cluster members + cascade).
  const scopeAssetIds = new Set<string>();
  if (a.asset) scopeAssetIds.add(a.asset.id);
  if (a.cluster) {
    const seedIds = a.cluster.memberships.map((m) => m.assetId);
    for (const id of seedIds) scopeAssetIds.add(id);
    if (
      (a.cluster.statusPropagation === 'CASCADE_DOWN' ||
        a.cluster.statusPropagation === 'BIDIRECTIONAL') &&
      seedIds.length > 0
    ) {
      let frontier = seedIds;
      while (frontier.length > 0) {
        const children = await prisma.asset.findMany({
          where: { tenantId, parentId: { in: frontier } },
          select: { id: true },
        });
        const next: string[] = [];
        for (const c of children) {
          if (!scopeAssetIds.has(c.id)) {
            scopeAssetIds.add(c.id);
            next.push(c.id);
          }
        }
        frontier = next;
      }
    }
  }
  const scopeAssets: ScopeAsset[] =
    scopeAssetIds.size === 0
      ? []
      : await prisma.asset.findMany({
          where: { tenantId, id: { in: Array.from(scopeAssetIds) } },
          select: { id: true, name: true, assetType: true, criticality: true },
          orderBy: [{ name: 'asc' }],
        });

  // Derive scope label/description.
  const scopeLabel = a.asset
    ? `Asset · ${a.asset.name}`
    : a.cluster
      ? `${a.cluster.clusterType} cluster · ${a.cluster.name}`
      : 'Organisation-wide';

  // Changelog from snapshots. `reason` is the machine-readable action,
  // payload.note (set by captureSnapshot) carries the human-readable detail.
  const changeLog: ChangeLogEntry[] = a.snapshots.map((s) => {
    const payload = (s.payload ?? {}) as { note?: unknown };
    const note = typeof payload.note === 'string' ? payload.note : '';
    return {
      date: s.capturedAt,
      user: `${s.capturedBy.firstName} ${s.capturedBy.lastName}`.trim(),
      action: s.reason,
      detail: note || s.reason,
    };
  });

  const threats = a.threats.map(computeThreatFields);

  const protectiveCoverage = await getProtectiveCoverageForAssessment(
    prisma,
    tenantId,
    { assetId: a.assetId, clusterId: a.clusterId },
  );

  // Step 6 bridge: existing CMs linked to any threat in this assessment,
  // plus all open gaps. Both feed the new report sections.
  const threatIds = threats.map((t) => t.id);
  const [cmRows, gapRows] = await Promise.all([
    threatIds.length === 0
      ? Promise.resolve([])
      : prisma.countermeasure.findMany({
          where: { tenantId, isExisting: true, assignedToThreatId: { in: threatIds } },
          include: { assignedToAsset: { select: { name: true } } },
          orderBy: [{ updatedAt: 'desc' }],
        }),
    prisma.countermeasureGap.findMany({
      where: { assessmentId: a.id, isOpen: true },
      include: { countermeasure: { select: { name: true } } },
      orderBy: [{ gapSeverity: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);
  const existingCountermeasures: ReportCountermeasure[] = cmRows.map((cm) => ({
    id: cm.id,
    name: cm.name,
    shapeCategory: cm.shapeCategory,
    ppsFunctions: cm.ppsFunctions,
    domain: cm.domain,
    implementationStatus: cm.implementationStatus,
    effectivenessRating: cm.effectivenessRating,
    effectivenessScore: cm.effectivenessScore,
    surveyRatingNumeric: cm.surveyRatingNumeric,
    gapDelta: cm.gapDelta,
    isExisting: cm.isExisting,
    assignedToAssetId: cm.assignedToAssetId,
    assignedToThreatId: cm.assignedToThreatId,
    assignedToAssetName: cm.assignedToAsset?.name ?? null,
  }));
  const openGaps: ReportCountermeasureGap[] = gapRows.map((g) => ({
    id: g.id,
    threatId: g.threatId,
    countermeasureId: g.countermeasureId,
    gapType: g.gapType,
    gapSeverity: g.gapSeverity,
    description: g.description,
    recommendedAction: g.recommendedAction,
    drivesTreatmentPriority: g.drivesTreatmentPriority,
    isOpen: g.isOpen,
    createdAt: g.createdAt,
    countermeasureName: g.countermeasure?.name ?? null,
  }));

  return {
    organization: a.organization,
    assessment: a,
    scope: { label: scopeLabel, description: a.scopeDescription },
    leadAssessor: a.leadAssessor,
    reviewer: a.reviewedBy,
    approver: a.approver,
    scopeAssets,
    protectiveCoverage,
    threats,
    actionPlans: a.actionPlans,
    recommendations: a.recommendations,
    changeLog,
    existingCountermeasures,
    openGaps,
    generatedAt: new Date(),
  };
}

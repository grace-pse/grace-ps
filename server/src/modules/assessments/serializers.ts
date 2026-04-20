import type { Prisma, RiskPriority } from '@prisma/client';

const PRIORITY_RANK: Record<RiskPriority, number> = {
  LOW: 1, MEDIUM: 2, HIGH: 3, HIGHEST: 4,
};

export function highestPriority(threats: { riskTreatmentPriority: RiskPriority | null }[]): RiskPriority | null {
  let best: RiskPriority | null = null;
  for (const t of threats) {
    if (!t.riskTreatmentPriority) continue;
    if (!best || PRIORITY_RANK[t.riskTreatmentPriority] > PRIORITY_RANK[best]) {
      best = t.riskTreatmentPriority;
    }
  }
  return best;
}

export const assessmentInclude = {
  asset: { select: { id: true, name: true } },
  cluster: { select: { id: true, name: true } },
  leadAssessor: { select: { id: true, firstName: true, lastName: true } },
  threats: { select: { id: true, riskTreatmentPriority: true } },
} as const;

export type AssessmentWithRelations = Prisma.AssessmentGetPayload<{
  include: typeof assessmentInclude;
}>;

export type ThreatWithAsset = Prisma.ThreatGetPayload<{
  include: { targetAsset: { select: { id: true; name: true } } };
}>;

export function toAssessmentSummary(a: AssessmentWithRelations) {
  const leadName = a.leadAssessor
    ? `${a.leadAssessor.firstName} ${a.leadAssessor.lastName}`.trim()
    : null;
  return {
    id: a.id,
    title: a.title,
    assessmentType: a.assessmentType,
    status: a.status,
    currentStep: a.currentStep,
    reviewStatus: a.reviewStatus,
    assetId: a.assetId,
    clusterId: a.clusterId,
    assetName: a.asset?.name ?? null,
    clusterName: a.cluster?.name ?? null,
    leadAssessorId: a.leadAssessorId,
    leadAssessorName: leadName,
    threatCount: a.threats.length,
    highestPriority: highestPriority(a.threats),
    startedAt: a.startedAt?.toISOString() ?? null,
    completedAt: a.completedAt?.toISOString() ?? null,
    updatedAt: a.updatedAt.toISOString(),
  };
}

type ComplianceTag = 'ISO_31000' | 'NIS2_ART_21' | 'NIS2_ART_23' | 'CER' | 'ASIS_SPC_1' | 'ISO_28000';

export function toThreatSummary(t: ThreatWithAsset) {
  return {
    id: t.id,
    assessmentId: t.assessmentId,
    targetAssetId: t.targetAssetId,
    targetAssetName: t.targetAsset?.name ?? null,
    adversaryType: t.adversaryType,
    actionType: t.actionType,
    adversaryDescription: t.adversaryDescription,
    actionDescription: t.actionDescription,
    locationContext: t.locationContext,
    facilitatingFactors: t.facilitatingFactors,
    timeContext: t.timeContext,
    likelihoodScore: t.likelihoodScore,
    likelihoodRationale: t.likelihoodRationale,
    impactScore: t.impactScore,
    impactRationale: t.impactRationale,
    impactBreakdown: t.impactBreakdown as Record<string, number> | null,
    irv: t.irv,
    vulnerabilityRating: t.vulnerabilityRating,
    vulnerabilityRationale: t.vulnerabilityRationale,
    riskTreatmentPriority: t.riskTreatmentPriority,
    tearStrategy: t.tearStrategy,
    alarpJustification: t.alarpJustification,
    complianceTags: t.complianceTags as ComplianceTag[],
    dbtReferenceId: t.dbtReferenceId,
  };
}

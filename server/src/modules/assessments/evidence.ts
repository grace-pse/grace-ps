// Shared helper for recomputing an assessment's evidence basis from its
// scope (asset/cluster) and whatever SurveyResponse rows are linked via
// assessment_surveys. Called from survey link/unlink endpoints, from
// survey submit, and (planned) nightly to flip surveyPending when the
// 180-day freshness window expires.

import { prisma } from '../../lib/prisma.js';

type EvidenceBasis = 'EXPERT_JUDGMENT' | 'SURVEY_LINKED' | 'MIXED';

const FRESHNESS_DAYS = 180;
const FRESHNESS_MS = FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

export interface EvidenceBasisResult {
  evidenceBasis: EvidenceBasis;
  surveyPending: boolean;
  lastSurveyDate: Date | null;
}

interface ScopeCluster {
  id: string;
  members: Array<{ clusterId: string }>;
}

/**
 * Computes the evidence basis for an assessment:
 *
 * - `SURVEY_LINKED` if every scope cluster (or the single scope asset's
 *   containing cluster) has >=1 approved/submitted survey within the
 *   freshness window.
 * - `MIXED` if some scope clusters have fresh surveys, others don't.
 * - `EXPERT_JUDGMENT` if no linked surveys are fresh (or there are none).
 *
 * `surveyPending` is true iff the most recent linked survey is older than
 * the freshness window or there are no linked surveys at all.
 */
export async function computeEvidenceBasis(assessmentId: string): Promise<EvidenceBasisResult> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      assetId: true,
      clusterId: true,
      surveys: {
        select: {
          surveyResponse: {
            select: {
              clusterId: true,
              conductedAt: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!assessment) {
    return { evidenceBasis: 'EXPERT_JUDGMENT', surveyPending: true, lastSurveyDate: null };
  }

  // Figure out which clusters are "in scope". A cluster-targeted assessment
  // has an explicit cluster; an asset-targeted one falls back to every
  // cluster the asset is a member of (typically zero or one).
  let scopeClusterIds: string[] = [];
  if (assessment.clusterId) {
    scopeClusterIds = [assessment.clusterId];
  } else if (assessment.assetId) {
    const memberships = await prisma.assetClusterMembership.findMany({
      where: { assetId: assessment.assetId },
      select: { clusterId: true },
    });
    scopeClusterIds = memberships.map((m) => m.clusterId);
  }

  const now = Date.now();
  const freshLinked = assessment.surveys
    .map((s) => s.surveyResponse)
    .filter(
      (r) =>
        r != null &&
        (r.status === 'SUBMITTED' || r.status === 'APPROVED') &&
        now - r.conductedAt.getTime() <= FRESHNESS_MS,
    );

  const lastSurveyDate =
    assessment.surveys.length === 0
      ? null
      : assessment.surveys
          .map((s) => s.surveyResponse?.conductedAt ?? null)
          .filter((d): d is Date => d != null)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  if (scopeClusterIds.length === 0) {
    // Asset without cluster membership — collapse to a single bucket of
    // "any fresh linked survey" vs "none". No notion of mixed.
    if (freshLinked.length === 0) {
      return { evidenceBasis: 'EXPERT_JUDGMENT', surveyPending: true, lastSurveyDate };
    }
    return { evidenceBasis: 'SURVEY_LINKED', surveyPending: false, lastSurveyDate };
  }

  const freshClusterIds = new Set(freshLinked.map((r) => r.clusterId));
  const covered = scopeClusterIds.filter((id) => freshClusterIds.has(id));

  let evidenceBasis: EvidenceBasis;
  if (covered.length === 0) evidenceBasis = 'EXPERT_JUDGMENT';
  else if (covered.length === scopeClusterIds.length) evidenceBasis = 'SURVEY_LINKED';
  else evidenceBasis = 'MIXED';

  const surveyPending = evidenceBasis !== 'SURVEY_LINKED';

  return { evidenceBasis, surveyPending, lastSurveyDate };
}

/**
 * Recomputes evidence basis and persists it on the assessment. Safe to call
 * from any mutation that might affect the linked survey set.
 */
export async function refreshAssessmentEvidenceBasis(assessmentId: string): Promise<void> {
  const next = await computeEvidenceBasis(assessmentId);
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      evidenceBasis: next.evidenceBasis,
      surveyPending: next.surveyPending,
      lastSurveyDate: next.lastSurveyDate,
    },
  });
}

// Exported for test / introspection scenarios.
export const _internals = { FRESHNESS_DAYS };
export type { ScopeCluster };

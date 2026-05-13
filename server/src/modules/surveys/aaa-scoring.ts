// Per-AAA roll-up scoring for AAA-driven survey responses.
//
// Given a SurveyResponse linked to a ClusterSurveyScope, walks the scope's
// items, classifies each answer with the existing severity logic, and
// produces:
//   - per-AAA-target rows (one per Asset/Threat/CM/CM-group/MANUAL bucket)
//   - two roll-up ratings:
//       vulnerabilityRating  = Asset + Countermeasure(_GROUP) + MANUAL items
//       likelihoodRating     = Threat items
//
// The vulnerability track feeds Step 6 of the wizard; the likelihood track
// feeds Step 3. Bands match the legacy SurveyRating enum so downstream
// EvidenceBasis logic keeps working unchanged.

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type Severity = 'ok' | 'warn' | 'bad';
type SurveyRating = 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';

const NUMERIC_BAND_KEYS = ['BELOW_30', '30_TO_60', 'ABOVE_60'] as const;

function classifyAnswer(
  type: string,
  severityMap: Record<string, Severity> | null | undefined,
  raw: unknown,
): Severity | null {
  if (raw == null || raw === '') return null;
  if (!severityMap) return null;
  const coerce = String(raw).toUpperCase();

  if (type === 'yes_no_partial') {
    const key = coerce === 'YES' || coerce === 'NO' || coerce === 'PARTIAL' ? coerce : null;
    if (!key) return null;
    return severityMap[key] ?? null;
  }
  if (type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const key = n < 30 ? 'BELOW_30' : n <= 60 ? '30_TO_60' : 'ABOVE_60';
    if (!NUMERIC_BAND_KEYS.includes(key as (typeof NUMERIC_BAND_KEYS)[number])) return null;
    return severityMap[key] ?? null;
  }
  // text / select: direct match
  return severityMap[coerce] ?? null;
}

function severityPoints(sev: Severity, weight: number): number {
  if (sev === 'ok') return weight;
  if (sev === 'warn') return weight * 0.5;
  return 0;
}

function pctToRating(pct: number): SurveyRating {
  if (pct >= 80) return 'STRONG';
  if (pct >= 60) return 'BASELINE';
  if (pct >= 40) return 'BARELY_ADEQUATE';
  return 'INADEQUATE';
}

interface BucketKey {
  sourceType: 'ASSET' | 'THREAT' | 'COUNTERMEASURE' | 'COUNTERMEASURE_GROUP' | 'MANUAL';
  sourceAssetId: string | null;
  sourceThreatId: string | null;
  sourceCountermeasureId: string | null;
  sourceCountermeasureTemplateId: string | null;
}

function bucketSignature(k: BucketKey): string {
  return [
    k.sourceType,
    k.sourceAssetId ?? '',
    k.sourceThreatId ?? '',
    k.sourceCountermeasureId ?? '',
    k.sourceCountermeasureTemplateId ?? '',
  ].join('|');
}

interface BucketAcc extends BucketKey {
  earned: number;
  possible: number;
  answered: number;
  total: number;
}

export interface AaaScoringResult {
  vulnerabilityScorePct: number | null;
  vulnerabilityRating: SurveyRating | null;
  likelihoodScorePct: number | null;
  likelihoodRating: SurveyRating | null;
  perAaaScores: Array<{
    sourceType: BucketKey['sourceType'];
    sourceAssetId: string | null;
    sourceThreatId: string | null;
    sourceCountermeasureId: string | null;
    sourceCountermeasureTemplateId: string | null;
    scorePct: number | null;
    rating: SurveyRating | null;
    answeredCount: number;
    totalCount: number;
  }>;
}

/**
 * Compute per-AAA scores plus the two roll-up ratings for a given response,
 * AND persist them to SurveyResponseAaaScore rows + the response's own
 * vulnerability/likelihood columns. Wraps in a single transaction.
 */
export async function scoreAndPersistAaaResponse(responseId: string): Promise<AaaScoringResult> {
  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: {
      scope: {
        include: {
          items: { include: { question: true } },
        },
      },
    },
  });
  if (!response || !response.scope) {
    throw new Error('Response is not linked to a ClusterSurveyScope');
  }

  const answers = (response.answers ?? {}) as Record<string, unknown>;
  const buckets = new Map<string, BucketAcc>();

  for (const item of response.scope.items) {
    const key: BucketKey = {
      sourceType: item.sourceType,
      sourceAssetId: item.sourceAssetId,
      sourceThreatId: item.sourceThreatId,
      sourceCountermeasureId: item.sourceCountermeasureId,
      sourceCountermeasureTemplateId: item.sourceCountermeasureTemplateId,
    };
    const sig = bucketSignature(key);
    let acc = buckets.get(sig);
    if (!acc) {
      acc = { ...key, earned: 0, possible: 0, answered: 0, total: 0 };
      buckets.set(sig, acc);
    }
    const weight = item.weightOverride ?? item.question.defaultWeight;
    acc.possible += weight;
    acc.total += 1;

    // Answers are keyed by scope-item id (the survey-run page writes them
    // under each item's id, not the question id, so duplicates of the same
    // question across different AAA targets stay independent).
    const raw =
      typeof answers[item.id] === 'object' && answers[item.id] !== null
        ? (answers[item.id] as { value?: unknown }).value
        : answers[item.id];
    const sev = classifyAnswer(
      item.question.type,
      (item.question.severityMap as Record<string, Severity> | null) ?? null,
      raw,
    );
    if (sev != null) {
      acc.answered += 1;
      acc.earned += severityPoints(sev, weight);
    }
  }

  // Per-AAA roll-ups.
  const perAaa: AaaScoringResult['perAaaScores'] = [];
  let vulnEarned = 0;
  let vulnPossible = 0;
  let vulnAnswered = 0;
  let likeEarned = 0;
  let likePossible = 0;
  let likeAnswered = 0;
  for (const acc of buckets.values()) {
    const scorePct = acc.answered === 0 || acc.possible === 0
      ? null
      : Math.round(((acc.earned / acc.possible) * 100) * 100) / 100;
    const rating = scorePct == null ? null : pctToRating(scorePct);
    perAaa.push({
      sourceType: acc.sourceType,
      sourceAssetId: acc.sourceAssetId,
      sourceThreatId: acc.sourceThreatId,
      sourceCountermeasureId: acc.sourceCountermeasureId,
      sourceCountermeasureTemplateId: acc.sourceCountermeasureTemplateId,
      scorePct,
      rating,
      answeredCount: acc.answered,
      totalCount: acc.total,
    });
    if (acc.sourceType === 'THREAT') {
      likeEarned += acc.earned;
      likePossible += acc.possible;
      likeAnswered += acc.answered;
    } else {
      // Vulnerability track: Asset + CM + CM_GROUP + MANUAL all aggregate here.
      vulnEarned += acc.earned;
      vulnPossible += acc.possible;
      vulnAnswered += acc.answered;
    }
  }

  const vulnerabilityScorePct = vulnAnswered === 0 || vulnPossible === 0
    ? null
    : Math.round(((vulnEarned / vulnPossible) * 100) * 100) / 100;
  const vulnerabilityRating = vulnerabilityScorePct == null ? null : pctToRating(vulnerabilityScorePct);
  const likelihoodScorePct = likeAnswered === 0 || likePossible === 0
    ? null
    : Math.round(((likeEarned / likePossible) * 100) * 100) / 100;
  const likelihoodRating = likelihoodScorePct == null ? null : pctToRating(likelihoodScorePct);

  // Persist.
  await prisma.$transaction(async (tx) => {
    await tx.surveyResponseAaaScore.deleteMany({ where: { responseId } });
    for (const row of perAaa) {
      await tx.surveyResponseAaaScore.create({
        data: {
          responseId,
          sourceType: row.sourceType,
          sourceAssetId: row.sourceAssetId,
          sourceThreatId: row.sourceThreatId,
          sourceCountermeasureId: row.sourceCountermeasureId,
          sourceCountermeasureTemplateId: row.sourceCountermeasureTemplateId,
          scorePct: row.scorePct == null ? null : new Prisma.Decimal(row.scorePct),
          rating: row.rating,
          answeredCount: row.answeredCount,
          totalCount: row.totalCount,
        },
      });
    }
    await tx.surveyResponse.update({
      where: { id: responseId },
      data: {
        vulnerabilityScorePct: vulnerabilityScorePct == null ? null : new Prisma.Decimal(vulnerabilityScorePct),
        vulnerabilityRating,
        likelihoodScorePct: likelihoodScorePct == null ? null : new Prisma.Decimal(likelihoodScorePct),
        likelihoodRating,
        // Mirror the vulnerability track into the legacy `scorePct`/`rating`
        // columns so downstream consumers (notifications, drift detection,
        // evidence-basis fallback) continue to see a sensible value.
        scorePct: vulnerabilityScorePct == null ? null : new Prisma.Decimal(vulnerabilityScorePct),
        rating: vulnerabilityRating,
      },
    });
  });

  return {
    vulnerabilityScorePct,
    vulnerabilityRating,
    likelihoodScorePct,
    likelihoodRating,
    perAaaScores: perAaa,
  };
}

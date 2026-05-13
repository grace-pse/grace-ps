import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ActionStatus, IrvBand, RiskPriority, TearStrategy, VulnerabilityRating } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  assessmentStatusEnum, evidenceBasisEnum, riskPriorityEnum,
  irvBandEnum, vulnerabilityEnum, tearStrategyEnum,
  complianceTagEnum, threatSummarySchema,
} from './schema.js';
import { toThreatSummary } from './serializers.js';
import { protectiveCoverageItemSchema } from '../assets/schema.js';
import { getProtectiveCoverageForAssessment } from '../../lib/protective-coverage.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

const actionStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED']);

// Bucket key includes 'UNSCORED' for rows whose dimension is null.
const bucketSchema = z.object({
  key: z.string(),
  count: z.number().int(),
  pct: z.number(),
});

const heroSchema = z.object({
  id: uuid,
  title: z.string(),
  version: z.string(),
  status: assessmentStatusEnum,
  assetName: z.string().nullable(),
  clusterName: z.string().nullable(),
  period: z.string().nullable(),
  scopeDescription: z.string().nullable(),
  evidenceBasis: evidenceBasisEnum,
  leadAssessorName: z.string().nullable(),
  approverName: z.string().nullable(),
  reviewerName: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  signedOffAt: z.string().datetime().nullable(),
});

const postureSchema = z.object({
  totalThreats: z.number().int(),
  highestPriority: riskPriorityEnum.nullable(),
  highOrExtremeIrvCount: z.number().int(),
  unscoredThreatsCount: z.number().int(),
});

const actionPlanProgressSchema = z.object({
  total: z.number().int(),
  byStatus: z.array(bucketSchema),
  completionPct: z.number(),
  overdueCount: z.number().int(),
  nextDueDate: z.string().nullable(),
});

const complianceItemSchema = z.object({
  tag: complianceTagEnum,
  threatCount: z.number().int(),
});

const recommendationItemSchema = z.object({
  id: uuid,
  ref: z.string(),
  priority: riskPriorityEnum,
  title: z.string(),
  body: z.string(),
  owner: z.string().nullable(),
  horizon: z.string().nullable(),
  cost: z.string().nullable(),
});

export const assessmentSummaryResponseSchema = z.object({
  hero: heroSchema,
  posture: postureSchema,
  irvDistribution: z.array(bucketSchema),
  priorityDistribution: z.array(bucketSchema),
  tearMix: z.array(bucketSchema),
  vulnerabilityMix: z.array(bucketSchema),
  topThreats: z.array(threatSummarySchema),
  actionPlan: actionPlanProgressSchema,
  compliance: z.array(complianceItemSchema),
  recommendations: z.array(recommendationItemSchema),
  protectiveCoverage: z.array(protectiveCoverageItemSchema),
});

// ── Reducers ─────────────────────────────────────────────────

const IRV_KEYS: (IrvBand | 'UNSCORED')[] = ['EXTREME', 'HIGH', 'MODERATE', 'LOW', 'NEGLIGIBLE', 'UNSCORED'];
const PRIORITY_KEYS: (RiskPriority | 'UNSCORED')[] = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED'];
const TEAR_KEYS: (TearStrategy | 'UNSCORED')[] = ['REDUCE', 'TRANSFER', 'ACCEPT', 'ELIMINATE', 'UNSCORED'];
const VULN_KEYS: (VulnerabilityRating | 'UNSCORED')[] = ['INADEQUATE', 'BARELY_ADEQUATE', 'BASELINE', 'STRONG', 'UNSCORED'];
const ACTION_STATUS_KEYS: ActionStatus[] = ['OVERDUE', 'IN_PROGRESS', 'PENDING', 'COMPLETED', 'CANCELLED'];

const PRIORITY_RANK: Record<RiskPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, HIGHEST: 4 };
const IRV_RANK: Record<IrvBand, number> = { NEGLIGIBLE: 1, LOW: 2, MODERATE: 3, HIGH: 4, EXTREME: 5 };

function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function toBuckets<K extends string>(
  rows: { key: K | null }[],
  keys: readonly (K | 'UNSCORED')[],
): { key: string; count: number; pct: number }[] {
  const total = rows.length;
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, 0);
  for (const r of rows) {
    const k = r.key ?? 'UNSCORED';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return keys.map((k) => ({ key: k, count: counts.get(k) ?? 0, pct: pct(counts.get(k) ?? 0, total) }));
}

function fullName(u: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!u) return null;
  const n = `${u.firstName} ${u.lastName}`.trim();
  return n.length > 0 ? n : null;
}

export default async function summaryRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/:id/summary',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['assessments'],
        summary: 'Executive summary of an assessment (hydrated for finished assessments)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: assessmentSummaryResponseSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;

      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          asset: { select: { id: true, name: true } },
          cluster: { select: { id: true, name: true } },
          leadAssessor: { select: { firstName: true, lastName: true } },
          approver: { select: { firstName: true, lastName: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const [threatsFull, actionPlans, recommendations] = await Promise.all([
        prisma.threat.findMany({
          where: { assessmentId: a.id },
          include: { targetAsset: { select: { id: true, name: true } } },
          orderBy: [{ createdAt: 'asc' }],
        }),
        prisma.actionPlan.findMany({
          where: { assessmentId: a.id },
          orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.recommendation.findMany({
          where: { assessmentId: a.id },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
      ]);

      const total = threatsFull.length;

      // Posture
      let highestPriority: RiskPriority | null = null;
      let highOrExtremeIrvCount = 0;
      let unscoredThreatsCount = 0;
      for (const t of threatsFull) {
        if (t.riskTreatmentPriority) {
          if (!highestPriority || PRIORITY_RANK[t.riskTreatmentPriority] > PRIORITY_RANK[highestPriority]) {
            highestPriority = t.riskTreatmentPriority;
          }
        }
        if (t.irv === 'HIGH' || t.irv === 'EXTREME') highOrExtremeIrvCount += 1;
        if (!t.irv && !t.riskTreatmentPriority) unscoredThreatsCount += 1;
      }

      // Distributions
      const irvDistribution = toBuckets(
        threatsFull.map((t) => ({ key: t.irv })),
        IRV_KEYS,
      );
      const priorityDistribution = toBuckets(
        threatsFull.map((t) => ({ key: t.riskTreatmentPriority })),
        PRIORITY_KEYS,
      );
      const tearMix = toBuckets(
        threatsFull.map((t) => ({ key: t.tearStrategy })),
        TEAR_KEYS,
      );
      const vulnerabilityMix = toBuckets(
        threatsFull.map((t) => ({ key: t.vulnerabilityRating })),
        VULN_KEYS,
      );

      // Top threats
      const topThreats = [...threatsFull]
        .sort((a1, b1) => {
          const pA = a1.riskTreatmentPriority ? PRIORITY_RANK[a1.riskTreatmentPriority] : 0;
          const pB = b1.riskTreatmentPriority ? PRIORITY_RANK[b1.riskTreatmentPriority] : 0;
          if (pA !== pB) return pB - pA;
          const iA = a1.irv ? IRV_RANK[a1.irv] : 0;
          const iB = b1.irv ? IRV_RANK[b1.irv] : 0;
          if (iA !== iB) return iB - iA;
          if ((b1.impactScore ?? 0) !== (a1.impactScore ?? 0)) return (b1.impactScore ?? 0) - (a1.impactScore ?? 0);
          if ((b1.likelihoodScore ?? 0) !== (a1.likelihoodScore ?? 0)) return (b1.likelihoodScore ?? 0) - (a1.likelihoodScore ?? 0);
          return a1.id.localeCompare(b1.id);
        })
        .slice(0, 5)
        .map(toThreatSummary);

      // Action plan progress
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      let overdueCount = 0;
      let completed = 0;
      let cancelled = 0;
      let nextDue: Date | null = null;
      const planByStatusRows: { key: ActionStatus | null }[] = [];
      for (const p of actionPlans) {
        planByStatusRows.push({ key: p.status });
        if (p.status === 'COMPLETED') completed += 1;
        if (p.status === 'CANCELLED') cancelled += 1;
        const isOpen = p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
        if (isOpen && p.targetDate) {
          if (p.targetDate < today || p.status === 'OVERDUE') overdueCount += 1;
          if (!nextDue || p.targetDate < nextDue) nextDue = p.targetDate;
        } else if (isOpen && p.status === 'OVERDUE') {
          overdueCount += 1;
        }
      }
      const planByStatus = ACTION_STATUS_KEYS.map((k) => {
        const c = planByStatusRows.filter((r) => r.key === k).length;
        return { key: k, count: c, pct: pct(c, actionPlans.length) };
      });
      const denom = actionPlans.length - cancelled;
      const completionPct = denom > 0 ? Math.round((completed / denom) * 1000) / 10 : 0;

      // Compliance — aggregate tags appearing on threats.
      const tagCounts = new Map<string, number>();
      for (const t of threatsFull) {
        for (const tag of (t.complianceTags ?? [])) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
      const compliance = [...tagCounts.entries()]
        .map(([tag, threatCount]) => ({ tag: tag as z.infer<typeof complianceTagEnum>, threatCount }))
        .sort((x, y) => y.threatCount - x.threatCount);

      const protectiveCoverage = await getProtectiveCoverageForAssessment(
        prisma,
        tenantId,
        { assetId: a.assetId, clusterId: a.clusterId },
      );

      return {
        hero: {
          id: a.id,
          title: a.title,
          version: a.version,
          status: a.status,
          assetName: a.asset?.name ?? null,
          clusterName: a.cluster?.name ?? null,
          period: a.period,
          scopeDescription: a.scopeDescription,
          evidenceBasis: a.evidenceBasis,
          leadAssessorName: fullName(a.leadAssessor),
          approverName: fullName(a.approver),
          reviewerName: fullName(a.reviewedBy),
          reviewNotes: a.reviewNotes,
          startedAt: a.startedAt?.toISOString() ?? null,
          completedAt: a.completedAt?.toISOString() ?? null,
          signedOffAt: a.signedOffAt?.toISOString() ?? null,
        },
        posture: {
          totalThreats: total,
          highestPriority,
          highOrExtremeIrvCount,
          unscoredThreatsCount,
        },
        irvDistribution,
        priorityDistribution,
        tearMix,
        vulnerabilityMix,
        topThreats,
        actionPlan: {
          total: actionPlans.length,
          byStatus: planByStatus,
          completionPct,
          overdueCount,
          nextDueDate: nextDue ? nextDue.toISOString().slice(0, 10) : null,
        },
        compliance,
        recommendations: recommendations.map((r) => ({
          id: r.id,
          ref: r.ref,
          priority: r.priority,
          title: r.title,
          body: r.body,
          owner: r.owner,
          horizon: r.horizon,
          cost: r.cost,
        })),
        protectiveCoverage,
      };
    },
  );
}

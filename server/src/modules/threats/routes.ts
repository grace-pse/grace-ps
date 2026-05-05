import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  threatListQuerySchema,
  threatListResponseSchema,
} from './schema.js';

type JwtPayload = { sub: string; tenantId: string; role: string };

const include = {
  targetAsset: { select: { id: true, name: true } },
  assessment: { select: { id: true, title: true, status: true } },
  dbtReference: { select: { id: true, scenarioName: true, csmpUnitReference: true } },
  _count: { select: { countermeasures: true, actionPlans: true } },
} satisfies Prisma.ThreatInclude;

type ThreatWithRelations = Prisma.ThreatGetPayload<{ include: typeof include }>;

type ComplianceTag =
  | 'ISO_31000' | 'NIS2_ART_21' | 'NIS2_ART_23' | 'CER' | 'ASIS_SPC_1' | 'ISO_28000';

function toCatalogItem(t: ThreatWithRelations) {
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
    assessmentTitle: t.assessment?.title ?? null,
    assessmentStatus: t.assessment.status,
    dbtScenarioName: t.dbtReference?.scenarioName ?? null,
    dbtCsmpUnitReference: t.dbtReference?.csmpUnitReference ?? null,
    countermeasureCount: t._count.countermeasures,
    actionPlanCount: t._count.actionPlans,
    updatedAt: t.updatedAt.toISOString(),
  };
}

export default async function threatRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['threats'],
        summary: 'List threats across all assessments in the tenant',
        security: [{ bearerAuth: [] }],
        querystring: threatListQuerySchema,
        response: { 200: threatListResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const q = req.query;

      const where: Prisma.ThreatWhereInput = {
        assessment: { tenantId },
      };
      if (q.adversaryType) where.adversaryType = q.adversaryType;
      if (q.actionType) where.actionType = q.actionType;
      if (q.targetAssetId) where.targetAssetId = q.targetAssetId;
      if (q.assessmentId) where.assessmentId = q.assessmentId;
      if (q.irv) where.irv = q.irv;
      if (q.riskTreatmentPriority) where.riskTreatmentPriority = q.riskTreatmentPriority;
      if (q.vulnerabilityRating) where.vulnerabilityRating = q.vulnerabilityRating;
      if (q.tearStrategy) where.tearStrategy = q.tearStrategy;
      if (q.dbtLinked === 'yes') where.dbtReferenceId = { not: null };
      if (q.dbtLinked === 'no') where.dbtReferenceId = null;
      if (q.complianceTag) where.complianceTags = { has: q.complianceTag };
      if (q.search) {
        where.OR = [
          { adversaryDescription: { contains: q.search, mode: 'insensitive' } },
          { actionDescription: { contains: q.search, mode: 'insensitive' } },
          { locationContext: { contains: q.search, mode: 'insensitive' } },
          { facilitatingFactors: { contains: q.search, mode: 'insensitive' } },
          { targetAsset: { name: { contains: q.search, mode: 'insensitive' } } },
          { assessment: { title: { contains: q.search, mode: 'insensitive' } } },
        ];
      }

      const skip = (q.page - 1) * q.pageSize;
      const [items, total] = await Promise.all([
        prisma.threat.findMany({
          where,
          include,
          orderBy: [{ updatedAt: 'desc' }],
          skip,
          take: q.pageSize,
        }),
        prisma.threat.count({ where }),
      ]);
      return {
        items: items.map(toCatalogItem),
        total,
        page: q.page,
        pageSize: q.pageSize,
      };
    },
  );
}

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  calculateIrv, calculatePriority, compositeImpact,
  type IrvBand, type Vulnerability,
} from '../../lib/risk-engine.js';
import {
  assessmentCreateSchema, assessmentUpdateSchema,
  assessmentListQuerySchema, assessmentListResponseSchema,
  assessmentSummarySchema, assessmentDetailSchema,
  threatSummarySchema, threatCreateSchema, threatUpdateSchema,
  likelihoodRatingSchema, impactRatingSchema, vulnerabilityRatingSchema,
  tearStrategySchema,
  reviewActionSchema, advanceResponseSchema,
  suggestedThreatsResponseSchema, threatFromTemplateSchema,
} from './schema.js';
import {
  assessmentInclude, toAssessmentSummary, toThreatSummary,
  type AssessmentWithRelations,
} from './serializers.js';
import { captureSnapshot } from './snapshots.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

const STEP_STATUS = [
  'STEP_1_ASSETS', 'STEP_2_THREATS', 'STEP_3_LIKELIHOOD', 'STEP_4_IMPACT',
  'STEP_5_IRV', 'STEP_6_VULNERABILITY', 'STEP_7_TREATMENT',
] as const;

export default async function assessmentRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST ─────────────────────────────────────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['assessments'],
        summary: 'List assessments in current org',
        security: [{ bearerAuth: [] }],
        querystring: assessmentListQuerySchema,
        response: { 200: assessmentListResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const { search, status, reviewStatus, leadAssessorId, complianceTag, page, pageSize } = req.query;

      const where: Prisma.AssessmentWhereInput = { tenantId };
      if (status) where.status = status;
      if (reviewStatus) where.reviewStatus = reviewStatus;
      if (leadAssessorId) where.leadAssessorId = leadAssessorId;
      if (search) where.title = { contains: search, mode: 'insensitive' };
      if (complianceTag) where.threats = { some: { complianceTags: { has: complianceTag } } };

      const [items, total] = await Promise.all([
        prisma.assessment.findMany({
          where,
          include: assessmentInclude,
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.assessment.count({ where }),
      ]);

      return { items: items.map(toAssessmentSummary), total, page, pageSize };
    },
  );

  // ── DETAIL ───────────────────────────────────────────────
  router.get(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['assessments'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: assessmentDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          ...assessmentInclude,
          threats: true,
        },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const threatsFull = await prisma.threat.findMany({
        where: { assessmentId: a.id },
        include: { targetAsset: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'asc' }],
      });

      const summary = toAssessmentSummary({
        ...a,
        threats: a.threats.map((t) => ({ id: t.id, riskTreatmentPriority: t.riskTreatmentPriority })),
      } as AssessmentWithRelations);

      return {
        ...summary,
        threats: threatsFull.map(toThreatSummary),
        reviewedById: a.reviewedById,
        reviewNotes: a.reviewNotes,
      };
    },
  );

  // ── CREATE ───────────────────────────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Start a new assessment (step 1)',
        security: [{ bearerAuth: [] }],
        body: assessmentCreateSchema,
        response: { 201: assessmentSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const { title, assessmentType, assetId, clusterId, evidenceBasis, expertJustification } = req.body;

      if (assetId) {
        const asset = await prisma.asset.findFirst({
          where: { id: assetId, tenantId }, select: { id: true },
        });
        if (!asset) return reply.code(404).send({ error: 'Asset not found' });
      }
      if (clusterId) {
        const cluster = await prisma.assetCluster.findFirst({
          where: { id: clusterId, tenantId }, select: { id: true },
        });
        if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });
      }

      const created = await prisma.assessment.create({
        data: {
          tenantId,
          title,
          assessmentType,
          assetId: assetId ?? null,
          clusterId: clusterId ?? null,
          leadAssessorId: sub,
          status: 'STEP_1_ASSETS',
          currentStep: 1,
          startedAt: new Date(),
          evidenceBasis,
          expertJustification: expertJustification ?? null,
          surveyPending: evidenceBasis !== 'SURVEY_LINKED',
        },
        include: assessmentInclude,
      });

      return reply.code(201).send(toAssessmentSummary(created));
    },
  );

  // ── UPDATE (metadata only) ───────────────────────────────
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: assessmentUpdateSchema,
        response: { 200: assessmentSummarySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const existing = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId },
        select: {
          id: true, approverId: true, version: true, period: true, scopeDescription: true,
          evidenceBasis: true, expertJustification: true,
        },
      });
      if (!existing) return reply.code(404).send({ error: 'Assessment not found' });

      if (req.body.approverId) {
        const approver = await prisma.user.findFirst({
          where: { id: req.body.approverId, tenantId }, select: { id: true },
        });
        if (!approver) return reply.code(400).send({ error: 'Approver not found in this organisation' });
      }

      const changed: string[] = [];
      if (req.body.approverId !== undefined && req.body.approverId !== existing.approverId) changed.push('approver');
      if (req.body.version !== undefined && req.body.version !== existing.version) changed.push('version');
      if (req.body.period !== undefined && req.body.period !== existing.period) changed.push('period');
      if (req.body.scopeDescription !== undefined && req.body.scopeDescription !== existing.scopeDescription) changed.push('scope description');
      if (req.body.evidenceBasis !== undefined && req.body.evidenceBasis !== existing.evidenceBasis) changed.push('evidence basis');
      if (req.body.expertJustification !== undefined && req.body.expertJustification !== existing.expertJustification) changed.push('expert justification');

      const updated = await prisma.assessment.update({
        where: { id: req.params.id },
        data: req.body,
        include: assessmentInclude,
      });
      if (changed.length > 0) {
        await captureSnapshot({
          assessmentId: existing.id,
          capturedById: sub,
          reason: 'METADATA_UPDATED',
          note: changed.join(', '),
        });
      }
      return toAssessmentSummary(updated);
    },
  );

  // ── DELETE ───────────────────────────────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });
      await prisma.assessment.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    },
  );

  // ── ADVANCE STEP ─────────────────────────────────────────
  router.post(
    '/:id/advance',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Advance wizard to next step or submit for review',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: advanceResponseSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          threats: { select: { id: true, likelihoodScore: true, impactScore: true, vulnerabilityRating: true, riskTreatmentPriority: true, tearStrategy: true, alarpJustification: true, adversaryType: true, actionType: true } },
          actionPlans: { select: { threatId: true } },
        },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const step = a.currentStep;
      const threats = a.threats;

      if (step === 2 && threats.length === 0) {
        return reply.code(400).send({ error: 'At least one threat must be defined before advancing' });
      }
      if (step === 3 && threats.some((t) => t.likelihoodScore == null)) {
        return reply.code(400).send({ error: 'All threats must have likelihood scores' });
      }
      if (step === 4 && threats.some((t) => t.impactScore == null)) {
        return reply.code(400).send({ error: 'All threats must have impact scores' });
      }
      if (step === 6 && threats.some((t) => t.vulnerabilityRating == null)) {
        return reply.code(400).send({ error: 'All threats must have vulnerability ratings' });
      }
      // GRACE v2 P0: when advancing past Step 6 on an EXPERT_JUDGMENT assessment,
      // any L>=3 or I>=3 threat requires >=100 chars of expert justification so
      // downstream reviewers can audit why the risk was accepted without a survey.
      if (step === 6 && a.evidenceBasis === 'EXPERT_JUDGMENT') {
        const hasSignificantRisk = threats.some(
          (t) => (t.likelihoodScore ?? 0) >= 3 || (t.impactScore ?? 0) >= 3,
        );
        const justification = a.expertJustification?.trim() ?? '';
        if (hasSignificantRisk && justification.length < 100) {
          return reply.code(400).send({
            error: 'Expert-judgment assessments with significant risk (L≥3 or I≥3) require an expert justification of at least 100 characters. Link a survey or provide the justification before advancing.',
          });
        }
      }
      if (step >= 7) {
        const threatsWithPlans = new Set(a.actionPlans.map((p) => p.threatId));
        const highPriority = threats.filter(
          (t) => t.riskTreatmentPriority === 'HIGH' || t.riskTreatmentPriority === 'HIGHEST',
        );

        const missingTear = highPriority.filter((t) => !t.tearStrategy);
        if (missingTear.length > 0) {
          const names = missingTear.slice(0, 5)
            .map((t) => `'${t.adversaryType}/${t.actionType}'`).join(', ');
          const more = missingTear.length > 5 ? ` (+${missingTear.length - 5} more)` : '';
          return reply.code(400).send({
            error: `Cannot submit for review: ${missingTear.length} HIGH/HIGHEST priority threat(s) need a TEAR strategy — ${names}${more}`,
          });
        }

        const missingPlan = highPriority.filter(
          (t) => t.tearStrategy === 'REDUCE' && !threatsWithPlans.has(t.id),
        );
        if (missingPlan.length > 0) {
          const names = missingPlan.slice(0, 5)
            .map((t) => `'${t.adversaryType}/${t.actionType}'`).join(', ');
          const more = missingPlan.length > 5 ? ` (+${missingPlan.length - 5} more)` : '';
          return reply.code(400).send({
            error: `Cannot submit for review: ${missingPlan.length} REDUCE-strategy threat(s) need at least one action plan — ${names}${more}`,
          });
        }

        const missingAlarp = highPriority.filter(
          (t) => t.tearStrategy && t.tearStrategy !== 'REDUCE'
            && (!t.alarpJustification || t.alarpJustification.trim().length === 0),
        );
        if (missingAlarp.length > 0) {
          const names = missingAlarp.slice(0, 5)
            .map((t) => `'${t.adversaryType}/${t.actionType}'`).join(', ');
          const more = missingAlarp.length > 5 ? ` (+${missingAlarp.length - 5} more)` : '';
          return reply.code(400).send({
            error: `Cannot submit for review: ${missingAlarp.length} ACCEPT/TRANSFER/ELIMINATE threat(s) need an ALARP justification — ${names}${more}`,
          });
        }
      }

      let nextStatus: typeof a.status;
      let nextStep = step;
      let nextReview = a.reviewStatus;
      if (step >= 7) {
        nextStatus = 'REVIEW';
        nextReview = 'IN_REVIEW';
      } else {
        nextStep = step + 1;
        nextStatus = STEP_STATUS[nextStep - 1]!;
      }

      const updated = await prisma.assessment.update({
        where: { id: a.id },
        data: { currentStep: nextStep, status: nextStatus, reviewStatus: nextReview },
        select: { id: true, status: true, currentStep: true, reviewStatus: true },
      });

      if (nextStatus === 'REVIEW') {
        await captureSnapshot({
          assessmentId: a.id,
          capturedById: (req.user as JwtPayload).sub,
          reason: 'SUBMITTED_FOR_REVIEW',
        });
      } else {
        await captureSnapshot({
          assessmentId: a.id,
          capturedById: (req.user as JwtPayload).sub,
          reason: 'STEP_ADVANCED',
          note: `step ${step} → ${nextStep}`,
        });
      }
      return updated;
    },
  );

  // ── REVIEW (approve / reject) ────────────────────────────
  router.post(
    '/:id/review',
    {
      onRequest: [app.authenticate, requirePermission('assessments:review')],
      schema: {
        tags: ['assessments'],
        summary: 'Approve or reject an assessment under review',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: reviewActionSchema,
        response: { 200: advanceResponseSchema, 400: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub, role } = req.user as JwtPayload;
      const { action, notes } = req.body;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true, status: true, reviewStatus: true, leadAssessorId: true, currentStep: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      if (a.reviewStatus === 'APPROVED') {
        return reply.code(409).send({ error: 'Already finalized: assessment is APPROVED' });
      }
      if (a.reviewStatus !== 'IN_REVIEW') {
        return reply.code(409).send({ error: `Cannot review from reviewStatus=${a.reviewStatus}` });
      }

      if (action === 'approve') {
        if (!['ADMIN', 'REVIEWER', 'LEAD_ASSESSOR'].includes(role)) {
          return reply.code(403).send({ error: 'Forbidden: missing approval permission' });
        }
        if (a.leadAssessorId === sub) {
          return reply.code(403).send({
            error: 'Separation of duties: lead assessor cannot approve their own assessment',
          });
        }
        const now = new Date();
        const updated = await prisma.assessment.update({
          where: { id: a.id },
          data: {
            status: 'APPROVED', reviewStatus: 'APPROVED',
            reviewedById: sub, reviewNotes: notes || null,
            completedAt: now,
            signedOffAt: now,
          },
          select: { id: true, status: true, currentStep: true, reviewStatus: true },
        });
        await captureSnapshot({
          assessmentId: a.id, capturedById: sub, reason: 'APPROVED',
        });
        return updated;
      }

      // reject
      const updated = await prisma.assessment.update({
        where: { id: a.id },
        data: {
          reviewStatus: 'REJECTED',
          reviewedById: sub, reviewNotes: notes || null,
        },
        select: { id: true, status: true, currentStep: true, reviewStatus: true },
      });
      await captureSnapshot({
        assessmentId: a.id, capturedById: sub, reason: 'REJECTED',
      });
      return updated;
    },
  );

  // ════════════════════════════════════════════════════════
  // THREATS (nested)
  // ════════════════════════════════════════════════════════

  async function loadScopedAssessment(id: string, tenantId: string) {
    return prisma.assessment.findFirst({ where: { id, tenantId }, select: { id: true } });
  }

  // Resolves scope assets for an assessment (single asset or cluster members).
  // For clusters with statusPropagation=CASCADE_DOWN or BIDIRECTIONAL, descends
  // the parentId hierarchy so every descendant of an explicit member is in scope.
  // PROTECTIVE assets are filtered out — they belong to Step 6 (Vulnerability),
  // not Step 2 (AAA matrix). DUAL passes through.
  async function resolveScopeAssets(assessmentId: string, tenantId: string) {
    const a = await prisma.assessment.findFirst({
      where: { id: assessmentId, tenantId },
      select: { id: true, assetId: true, clusterId: true },
    });
    if (!a) return null;
    const assetIds = new Set<string>();
    if (a.assetId) assetIds.add(a.assetId);
    if (a.clusterId) {
      const cluster = await prisma.assetCluster.findFirst({
        where: { id: a.clusterId, tenantId },
        select: {
          statusPropagation: true,
          memberships: { select: { assetId: true } },
        },
      });
      if (cluster) {
        const seedIds = cluster.memberships.map((m) => m.assetId);
        for (const id of seedIds) assetIds.add(id);

        const cascades =
          cluster.statusPropagation === 'CASCADE_DOWN' ||
          cluster.statusPropagation === 'BIDIRECTIONAL';
        if (cascades && seedIds.length > 0) {
          let frontier = seedIds;
          while (frontier.length > 0) {
            const children = await prisma.asset.findMany({
              where: {
                tenantId,
                parentId: { in: frontier },
                assetRole: { not: 'PROTECTIVE' },
              },
              select: { id: true },
            });
            const next: string[] = [];
            for (const c of children) {
              if (!assetIds.has(c.id)) {
                assetIds.add(c.id);
                next.push(c.id);
              }
            }
            frontier = next;
          }
        }
      }
    }

    if (assetIds.size === 0) {
      return { assessmentId: a.id, assetIds: [] };
    }

    // Final filter: belt + braces in case legacy data put a PROTECTIVE asset
    // into a cluster before the role-aware membership check existed, or a
    // single-asset assessment was created against a PROTECTIVE asset.
    const allowed = await prisma.asset.findMany({
      where: {
        tenantId,
        id: { in: [...assetIds] },
        assetRole: { not: 'PROTECTIVE' },
      },
      select: { id: true },
    });
    return { assessmentId: a.id, assetIds: allowed.map((x) => x.id) };
  }

  // ── SUGGEST THREATS FROM TEMPLATE LIBRARY ───────────────
  router.get(
    '/:id/suggested-threats',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['assessments'],
        summary: 'List recommended threats from template library for scope assets',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: suggestedThreatsResponseSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const scope = await resolveScopeAssets(req.params.id, tenantId);
      if (!scope) return reply.code(404).send({ error: 'Assessment not found' });
      if (scope.assetIds.length === 0) return { items: [] };

      const assets = await prisma.asset.findMany({
        where: { id: { in: scope.assetIds }, tenantId },
        select: {
          id: true, name: true, assetType: true, sourceTemplateId: true,
          sourceTemplate: {
            select: {
              id: true,
              // Only surface curated links from enabled packages — disabling a forked-from
              // package should silence its suggestions even for assets whose sourceTemplate
              // happens to live there. The asset's link itself stays intact.
              recommendedThreats: {
                where: { threatTemplate: { module: { package: { enabled: true } } } },
                select: {
                  relevance: true, rationale: true,
                  threatTemplate: {
                    select: {
                      id: true, scenarioName: true, adversaryType: true,
                      actionType: true, csmpUnitReference: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Fallback: only for assets WITHOUT a source template.
      // Templated assets trust the library's curated AssetTemplateThreat list exactly.
      const fallbackAssetTypes = Array.from(
        new Set(assets.filter((a) => !a.sourceTemplateId).map((a) => a.assetType)),
      );
      const typeMatchedTemplates = fallbackAssetTypes.length > 0 ? await prisma.threatTemplate.findMany({
        where: {
          targetAssetTypes: { hasSome: fallbackAssetTypes },
          module: { package: { enabled: true } },
        },
        select: {
          id: true, scenarioName: true, adversaryType: true,
          actionType: true, csmpUnitReference: true, targetAssetTypes: true,
        },
      }) : [];

      const existing = await prisma.threat.findMany({
        where: { assessmentId: scope.assessmentId },
        select: { targetAssetId: true, adversaryType: true, actionType: true },
      });
      const existingKey = new Set(
        existing.map((t) => `${t.targetAssetId}::${t.adversaryType}::${t.actionType}`),
      );

      const items = [];
      // Dedupe by the (assetId, adversaryType, actionType) triplet — the same key
      // the underlying Threat row enforces uniqueness on (see the dup check in the
      // /threats/from-template handler). Two distinct ThreatTemplates can carry
      // identical (adversary, action) — e.g. when a package is forked — and the
      // user can only ever materialize one Threat per triplet, so showing two
      // suggestions is misleading regardless of where the duplicates come from.
      const seen = new Set<string>();
      for (const asset of assets) {
        // Direct-linked via the asset's source template
        if (asset.sourceTemplate) {
          for (const link of asset.sourceTemplate.recommendedThreats) {
            const tt = link.threatTemplate;
            const k = `${asset.id}::${tt.adversaryType}::${tt.actionType}`;
            if (seen.has(k)) continue;
            seen.add(k);
            items.push({
              assetId: asset.id,
              assetName: asset.name,
              threatTemplateId: tt.id,
              scenarioName: tt.scenarioName,
              adversaryType: tt.adversaryType,
              actionType: tt.actionType,
              relevance: link.relevance,
              rationale: link.rationale,
              csmpUnitReference: tt.csmpUnitReference,
              alreadyAdded: existingKey.has(k),
            });
          }
        }
        // Type-matched fallback — only for assets WITHOUT a source template.
        if (asset.sourceTemplateId) continue;
        for (const tt of typeMatchedTemplates) {
          if (!tt.targetAssetTypes.includes(asset.assetType)) continue;
          const k = `${asset.id}::${tt.adversaryType}::${tt.actionType}`;
          if (seen.has(k)) continue;
          seen.add(k);
          items.push({
            assetId: asset.id,
            assetName: asset.name,
            threatTemplateId: tt.id,
            scenarioName: tt.scenarioName,
            adversaryType: tt.adversaryType,
            actionType: tt.actionType,
            relevance: 'MEDIUM' as const,
            rationale: `Matched by asset type (${asset.assetType})`,
            csmpUnitReference: tt.csmpUnitReference,
            alreadyAdded: existingKey.has(k),
          });
        }
      }
      // Sort: HIGH first, then MEDIUM, then LOW; then by scenario name
      const relRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
      items.sort((a, b) => {
        if (relRank[a.relevance] !== relRank[b.relevance]) {
          return relRank[a.relevance] - relRank[b.relevance];
        }
        return a.scenarioName.localeCompare(b.scenarioName);
      });
      return { items };
    },
  );

  // ── ADD THREAT FROM TEMPLATE ────────────────────────────
  router.post(
    '/:id/threats/from-template',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Materialize a Threat from a ThreatTemplate',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: threatFromTemplateSchema,
        response: { 201: threatSummarySchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const scope = await resolveScopeAssets(req.params.id, tenantId);
      if (!scope) return reply.code(404).send({ error: 'Assessment not found' });

      if (!scope.assetIds.includes(req.body.targetAssetId)) {
        return reply.code(404).send({ error: 'Target asset not in assessment scope' });
      }

      const tt = await prisma.threatTemplate.findUnique({
        where: { id: req.body.threatTemplateId },
        select: {
          id: true, scenarioName: true, adversaryType: true, actionType: true,
          adversaryProfile: true, typicalActions: true, csmpUnitReference: true,
        },
      });
      if (!tt) return reply.code(404).send({ error: 'Threat template not found' });

      const dup = await prisma.threat.findFirst({
        where: {
          assessmentId: scope.assessmentId,
          targetAssetId: req.body.targetAssetId,
          adversaryType: tt.adversaryType,
          actionType: tt.actionType,
        },
        select: { id: true },
      });
      if (dup) {
        return reply.code(409).send({ error: 'Threat already added for this asset + adversary/action pair' });
      }

      // Materialize or reuse a DBT record for this tenant from this template
      let dbt = await prisma.designBasisThreat.findFirst({
        where: { tenantId, sourceTemplateId: tt.id }, select: { id: true },
      });
      if (!dbt) {
        dbt = await prisma.designBasisThreat.create({
          data: {
            tenantId,
            sourceTemplateId: tt.id,
            scenarioName: tt.scenarioName,
            adversaryProfile: (tt.adversaryProfile ?? {}) as Prisma.InputJsonValue,
            typicalActions: tt.typicalActions,
            targetTypes: [],
            indicators: [],
            csmpUnitReference: tt.csmpUnitReference,
          },
          select: { id: true },
        });
      }

      const profile = (tt.adversaryProfile ?? {}) as Record<string, unknown>;
      const adversaryDescription =
        typeof profile['description'] === 'string' ? (profile['description'] as string) :
        typeof profile['profile'] === 'string' ? (profile['profile'] as string) : null;

      const actionDescription = tt.typicalActions.length > 0
        ? tt.typicalActions.slice(0, 3).join('; ')
        : null;

      const created = await prisma.threat.create({
        data: {
          assessmentId: scope.assessmentId,
          targetAssetId: req.body.targetAssetId,
          adversaryType: tt.adversaryType,
          actionType: tt.actionType,
          adversaryDescription,
          actionDescription,
          dbtReferenceId: dbt.id,
        },
        include: { targetAsset: { select: { id: true, name: true } } },
      });
      await captureSnapshot({
        assessmentId: scope.assessmentId,
        capturedById: (req.user as JwtPayload).sub,
        reason: 'THREAT_ADDED',
        note: `${created.adversaryType}/${created.actionType} on ${created.targetAsset?.name ?? 'asset'}`,
      });
      return reply.code(201).send(toThreatSummary(created));
    },
  );

  // ── ADD THREAT ──────────────────────────────────────────
  router.post(
    '/:id/threats',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Add a threat instance to an assessment',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: threatCreateSchema,
        response: { 201: threatSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const asset = await prisma.asset.findFirst({
        where: { id: req.body.targetAssetId, tenantId }, select: { id: true },
      });
      if (!asset) return reply.code(404).send({ error: 'Target asset not found' });

      const created = await prisma.threat.create({
        data: {
          assessmentId: a.id,
          targetAssetId: req.body.targetAssetId,
          adversaryType: req.body.adversaryType,
          actionType: req.body.actionType,
          adversaryDescription: req.body.adversaryDescription ?? null,
          actionDescription: req.body.actionDescription ?? null,
          locationContext: req.body.locationContext ?? null,
          facilitatingFactors: req.body.facilitatingFactors ?? null,
          timeContext: req.body.timeContext ?? null,
          dbtReferenceId: req.body.dbtReferenceId ?? null,
          complianceTags: req.body.complianceTags ?? [],
        },
        include: { targetAsset: { select: { id: true, name: true } } },
      });
      await captureSnapshot({
        assessmentId: a.id,
        capturedById: (req.user as JwtPayload).sub,
        reason: 'THREAT_ADDED',
        note: `${created.adversaryType}/${created.actionType} on ${created.targetAsset?.name ?? 'asset'}`,
      });
      return reply.code(201).send(toThreatSummary(created));
    },
  );

  // ── UPDATE THREAT (context fields) ──────────────────────
  router.patch(
    '/:id/threats/:threatId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: threatUpdateSchema,
        response: { 200: threatSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const existing = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id }, select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Threat not found' });

      const updated = await prisma.threat.update({
        where: { id: req.params.threatId },
        data: req.body,
        include: { targetAsset: { select: { id: true, name: true } } },
      });
      return toThreatSummary(updated);
    },
  );

  // ── DELETE THREAT ───────────────────────────────────────
  router.delete(
    '/:id/threats/:threatId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const existing = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id },
        select: { id: true, adversaryType: true, actionType: true, targetAsset: { select: { name: true } } },
      });
      if (!existing) return reply.code(404).send({ error: 'Threat not found' });
      await prisma.threat.delete({ where: { id: req.params.threatId } });
      await captureSnapshot({
        assessmentId: a.id,
        capturedById: (req.user as JwtPayload).sub,
        reason: 'THREAT_REMOVED',
        note: `${existing.adversaryType}/${existing.actionType} on ${existing.targetAsset?.name ?? 'asset'}`,
      });
      return reply.code(204).send();
    },
  );

  // ── RATE LIKELIHOOD ─────────────────────────────────────
  router.post(
    '/:id/threats/:threatId/likelihood',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Score threat likelihood (step 3)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: likelihoodRatingSchema,
        response: { 200: threatSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const existing = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id }, select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Threat not found' });

      const updated = await prisma.threat.update({
        where: { id: req.params.threatId },
        data: {
          likelihoodScore: req.body.likelihoodScore,
          likelihoodRationale: req.body.likelihoodRationale,
        },
        include: { targetAsset: { select: { id: true, name: true } } },
      });
      return toThreatSummary(updated);
    },
  );

  // ── RATE IMPACT (auto-calc IRV) ─────────────────────────
  router.post(
    '/:id/threats/:threatId/impact',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Score threat impact breakdown; auto-computes IRV (step 4)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: impactRatingSchema,
        response: { 200: threatSummarySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const t = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id },
        select: { id: true, likelihoodScore: true },
      });
      if (!t) return reply.code(404).send({ error: 'Threat not found' });
      if (t.likelihoodScore == null) {
        return reply.code(400).send({ error: 'Likelihood must be scored first' });
      }

      const composite = compositeImpact(req.body.impactBreakdown);
      const irv: IrvBand = calculateIrv(t.likelihoodScore, composite);

      const updated = await prisma.threat.update({
        where: { id: t.id },
        data: {
          impactScore: composite,
          impactRationale: req.body.impactRationale,
          impactBreakdown: req.body.impactBreakdown as Prisma.InputJsonValue,
          irv,
          // Clear downstream ratings since IRV changed
          vulnerabilityRating: null,
          vulnerabilityRationale: null,
          riskTreatmentPriority: null,
        },
        include: { targetAsset: { select: { id: true, name: true } } },
      });
      return toThreatSummary(updated);
    },
  );

  // ── RATE VULNERABILITY (auto-calc priority) ─────────────
  router.post(
    '/:id/threats/:threatId/vulnerability',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Score threat vulnerability; auto-computes treatment priority (step 6)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: vulnerabilityRatingSchema,
        response: { 200: threatSummarySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const t = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id },
        select: { id: true, irv: true },
      });
      if (!t) return reply.code(404).send({ error: 'Threat not found' });
      if (!t.irv) return reply.code(400).send({ error: 'IRV must be calculated first' });

      const priority = calculatePriority(t.irv as IrvBand, req.body.vulnerabilityRating as Vulnerability);

      const updated = await prisma.threat.update({
        where: { id: t.id },
        data: {
          vulnerabilityRating: req.body.vulnerabilityRating,
          vulnerabilityRationale: req.body.vulnerabilityRationale,
          riskTreatmentPriority: priority,
        },
        include: { targetAsset: { select: { id: true, name: true } } },
      });
      return toThreatSummary(updated);
    },
  );

  // ── SET TEAR STRATEGY (step 7) ──────────────────────────
  router.post(
    '/:id/threats/:threatId/tear',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Set TEAR treatment strategy and optional ALARP justification (step 7)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: tearStrategySchema,
        response: { 200: threatSummarySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const t = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id },
        select: { id: true, riskTreatmentPriority: true },
      });
      if (!t) return reply.code(404).send({ error: 'Threat not found' });
      if (!t.riskTreatmentPriority) {
        return reply.code(400).send({ error: 'Treatment priority must be computed first (complete step 6)' });
      }

      const alarp = req.body.alarpJustification?.trim() ?? null;
      const updated = await prisma.threat.update({
        where: { id: t.id },
        data: {
          tearStrategy: req.body.tearStrategy,
          alarpJustification: alarp && alarp.length > 0 ? alarp : null,
        },
        include: { targetAsset: { select: { id: true, name: true } } },
      });
      return toThreatSummary(updated);
    },
  );
}

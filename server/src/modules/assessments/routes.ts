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
  step6ContextResponseSchema,
  createGapSchema, closeGapSchema, countermeasureGapSummarySchema,
  linkCountermeasureToThreatSchema,
} from './schema.js';
import { countermeasureDetailSchema } from '../countermeasures/schema.js';
import { toDetail as toCountermeasureDetail } from '../countermeasures/routes.js';
import {
  vulnerabilityRatingToNumeric,
  effectiveVulnerability,
  gapSeverityFromIrv,
} from '../countermeasures/scoring.js';
import { paToCountermeasureDefaults } from '../countermeasures/pa-mapping.js';
import {
  getProtectiveCoverageForAsset,
  getProtectiveCoverageForAssessment,
  type ProtectiveCoverageItem,
} from '../../lib/protective-coverage.js';
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

      // Treatment priority uses the *effective* vulnerability — open gaps
      // (NO_CONTROL or INEFFECTIVE/DEGRADED_ASSET) downgrade the rated
      // value so Step 7 sees the residual exposure honestly.
      const openGaps = await prisma.countermeasureGap.findMany({
        where: {
          threatId: t.id, isOpen: true, drivesTreatmentPriority: true,
        },
        select: { gapType: true },
      });
      const effective = effectiveVulnerability(
        req.body.vulnerabilityRating as Vulnerability,
        openGaps.map((g) => g.gapType),
      );
      const priority = calculatePriority(t.irv as IrvBand, effective as Vulnerability);

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
      const { tenantId, role } = req.user as JwtPayload;
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

      // ALARP guard: accepting a threat that has an open gap is a governance
      // decision, not an assessor call. Require an approver role and a
      // ≥150-char justification (per gap-analysis doc §4.4).
      if (req.body.tearStrategy === 'ACCEPT') {
        const openGapCount = await prisma.countermeasureGap.count({
          where: { threatId: t.id, isOpen: true },
        });
        if (openGapCount > 0) {
          const canApprove = ['ADMIN', 'LEAD_ASSESSOR', 'REVIEWER'].includes(role);
          if (!canApprove) {
            return reply.code(403).send({
              error: 'Accepting a threat with an open control gap requires approver role (LEAD_ASSESSOR or REVIEWER).',
            });
          }
          const trimmed = req.body.alarpJustification?.trim() ?? '';
          if (trimmed.length < 150) {
            return reply.code(400).send({
              error: 'ALARP justification of at least 150 characters is required when accepting a threat with an open gap.',
            });
          }
        }
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

  // ════════════════════════════════════════════════════════
  // STEP 6 BRIDGE: existing controls, gaps, aggregate context
  // ════════════════════════════════════════════════════════

  // Latest survey rating for an assessment (used by step6-context).
  async function latestSurveyForAssessment(assessmentId: string, tenantId: string) {
    const a = await prisma.assessment.findFirst({
      where: { id: assessmentId, tenantId },
      select: { assetId: true, clusterId: true },
    });
    if (!a?.clusterId) return null;
    return prisma.surveyResponse.findFirst({
      where: { tenantId, clusterId: a.clusterId, status: { in: ['APPROVED', 'SUBMITTED'] } },
      orderBy: [{ conductedAt: 'desc' }],
      select: {
        rating: true,
        vulnerabilityRating: true,
        conductedAt: true,
      },
    });
  }

  function freshnessFor(date: Date | null): 'FRESH' | 'STALE_WARNING' | 'STALE' | 'NONE' {
    if (!date) return 'NONE';
    const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (days <= 30) return 'FRESH';
    if (days <= 90) return 'STALE_WARNING';
    return 'STALE';
  }

  // For each (threat × protective asset) in the assessment, ensure a
  // Countermeasure row exists. Idempotent: only creates when the pair is
  // unrepresented. Reuses coverage per target-asset to bound query cost.
  async function autoPromoteProtectiveAssets(tenantId: string, assessmentId: string): Promise<void> {
    const threats = await prisma.threat.findMany({
      where: { assessmentId },
      select: {
        id: true, targetAssetId: true, targetAsset: { select: { name: true, assetType: true } },
        vulnerabilityRating: true,
      },
    });
    if (threats.length === 0) return;

    // Dedup coverage queries by target asset.
    const targetAssetIds = [...new Set(threats.map((t) => t.targetAssetId))];
    const coverageByAsset = new Map<string, ProtectiveCoverageItem[]>();
    for (const aid of targetAssetIds) {
      coverageByAsset.set(aid, await getProtectiveCoverageForAsset(prisma, tenantId, aid));
    }

    // Single query for all existing (threat, asset) pairs in this assessment.
    const existing = await prisma.countermeasure.findMany({
      where: {
        tenantId,
        assignedToThreatId: { in: threats.map((t) => t.id) },
        assignedToAssetId: { not: null },
      },
      select: { assignedToThreatId: true, assignedToAssetId: true },
    });
    const existingPairs = new Set(
      existing.map((c) => `${c.assignedToThreatId}::${c.assignedToAssetId}`),
    );

    // We also need the PROTECTIVE asset's name + type to seed the CM defaults.
    const paIds = [...new Set(
      [...coverageByAsset.values()].flat().map((p) => p.protectiveAssetId),
    )];
    const paById = new Map(
      (await prisma.asset.findMany({
        where: { tenantId, id: { in: paIds } },
        select: { id: true, name: true, assetType: true },
      })).map((a) => [a.id, a]),
    );

    const creates: Prisma.CountermeasureCreateManyInput[] = [];
    for (const t of threats) {
      const cov = coverageByAsset.get(t.targetAssetId) ?? [];
      const surveyNumeric = t.vulnerabilityRating
        ? vulnerabilityRatingToNumeric(t.vulnerabilityRating)
        : null;
      for (const pa of cov) {
        const key = `${t.id}::${pa.protectiveAssetId}`;
        if (existingPairs.has(key)) continue;
        const paAsset = paById.get(pa.protectiveAssetId);
        if (!paAsset) continue;
        const defaults = paToCountermeasureDefaults(paAsset.assetType);
        creates.push({
          tenantId,
          name: paAsset.name,
          shapeCategory: defaults.shapeCategory,
          ppsFunctions: defaults.ppsFunctions,
          domain: defaults.domain,
          implementationStatus: 'IMPLEMENTED',
          isExisting: true,
          assignedToAssetId: pa.protectiveAssetId,
          assignedToThreatId: t.id,
          surveyRatingAtCreation: t.vulnerabilityRating,
          surveyRatingNumeric: surveyNumeric,
        });
      }
    }

    if (creates.length === 0) return;
    await prisma.countermeasure.createMany({ data: creates });
  }

  // ── STEP 6 CONTEXT (aggregate) ───────────────────────────
  router.get(
    '/:id/step6-context',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['assessments'],
        summary: 'Aggregate context for Step 6: protective assets, existing CMs, open gaps',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: step6ContextResponseSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true, assetId: true, clusterId: true, status: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      // Auto-promote: each PROTECTIVE asset surfaced in the coverage panel
      // is by default a control for the threat targeting it. We materialise
      // a Countermeasure row per (threat × PA) so the assessor can rate
      // effectiveness inline, gap_delta math works, and the PA shows up in
      // the PDF §5.1 with assignedToAssetName populated.
      //
      // Idempotent on (threatId, assetId): subsequent calls find the existing
      // CM and skip. Gated to editable assessment states (no writes once an
      // assessment is in REVIEW / APPROVED / ARCHIVED).
      const EDITABLE_STATUSES = new Set([
        'DRAFT', 'STEP_1_ASSETS', 'STEP_2_THREATS', 'STEP_3_LIKELIHOOD',
        'STEP_4_IMPACT', 'STEP_5_IRV', 'STEP_6_VULNERABILITY', 'STEP_7_TREATMENT',
      ]);
      if (EDITABLE_STATUSES.has(a.status)) {
        await autoPromoteProtectiveAssets(tenantId, a.id);
      }

      const [threats, protectiveAssets, openGaps, latestSurvey] = await Promise.all([
        prisma.threat.findMany({
          where: { assessmentId: a.id },
          include: {
            targetAsset: { select: { name: true } },
            countermeasures: {
              orderBy: [{ updatedAt: 'desc' }],
              select: {
                id: true, name: true, shapeCategory: true, ppsFunctions: true,
                domain: true, implementationStatus: true, effectivenessRating: true,
                effectivenessScore: true, surveyRatingNumeric: true, gapDelta: true,
                isExisting: true, assignedToAssetId: true, assignedToThreatId: true,
                effectivenessNotes: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        }),
        getProtectiveCoverageForAssessment(prisma, tenantId, {
          assetId: a.assetId, clusterId: a.clusterId,
        }),
        prisma.countermeasureGap.findMany({
          where: { assessmentId: a.id, isOpen: true },
          include: { countermeasure: { select: { name: true } } },
          orderBy: [{ createdAt: 'desc' }],
        }),
        latestSurveyForAssessment(a.id, tenantId),
      ]);

      const gapsByThreat = new Map<string, typeof openGaps>();
      for (const g of openGaps) {
        const arr = gapsByThreat.get(g.threatId) ?? [];
        arr.push(g);
        gapsByThreat.set(g.threatId, arr);
      }

      const degradedAssetsAlert = protectiveAssets.some(
        (p) => p.operationalStatus !== 'OPERATIONAL',
      );

      return {
        assessmentId: a.id,
        threats: threats.map((t) => {
          const threatGaps = gapsByThreat.get(t.id) ?? [];
          return {
            id: t.id,
            adversaryType: t.adversaryType,
            actionType: t.actionType,
            targetAssetId: t.targetAssetId,
            targetAssetName: t.targetAsset?.name ?? null,
            irv: t.irv,
            vulnerabilityRating: t.vulnerabilityRating,
            riskTreatmentPriority: t.riskTreatmentPriority,
            countermeasures: t.countermeasures.map((cm) => ({
              id: cm.id,
              threatId: cm.assignedToThreatId,
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
              effectivenessNotes: cm.effectivenessNotes,
            })),
            openGaps: threatGaps.map((g) => ({
              id: g.id,
              assessmentId: g.assessmentId,
              threatId: g.threatId,
              countermeasureId: g.countermeasureId,
              countermeasureName: g.countermeasure?.name ?? null,
              gapType: g.gapType,
              gapSeverity: g.gapSeverity,
              description: g.description,
              recommendedAction: g.recommendedAction,
              drivesTreatmentPriority: g.drivesTreatmentPriority,
              isOpen: g.isOpen,
              closedAt: g.closedAt ? g.closedAt.toISOString() : null,
              closingNotes: g.closingNotes,
              createdAt: g.createdAt.toISOString(),
            })),
            hasOpenGap: threatGaps.length > 0,
          };
        }),
        protectiveAssets: protectiveAssets.map((p) => ({
          ...p,
          assetType: String(p.assetType),
        })),
        surveyLatest: {
          rating: (latestSurvey?.vulnerabilityRating ?? latestSurvey?.rating ?? null) as
            'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE' | null,
          date: latestSurvey?.conductedAt ? latestSurvey.conductedAt.toISOString() : null,
          ageDays: latestSurvey?.conductedAt
            ? Math.floor((Date.now() - latestSurvey.conductedAt.getTime()) / 86_400_000)
            : null,
          freshness: freshnessFor(latestSurvey?.conductedAt ?? null),
        },
        degradedAssetsAlert,
      };
    },
  );

  // ── LINK EXISTING COUNTERMEASURE TO THREAT ───────────────
  // Marks the CM as isExisting=true and snapshots the current threat's
  // vulnerabilityRating as the survey baseline for future gap_delta math.
  router.post(
    '/:id/threats/:threatId/countermeasures',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Link an existing countermeasure to a threat (Step 6)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: linkCountermeasureToThreatSchema,
        response: { 200: countermeasureDetailSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const t = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id },
        select: { id: true, vulnerabilityRating: true },
      });
      if (!t) return reply.code(404).send({ error: 'Threat not found' });

      const cm = await prisma.countermeasure.findFirst({
        where: { id: req.body.countermeasureId, tenantId },
        select: { id: true, surveyRatingAtCreation: true },
      });
      if (!cm) return reply.code(404).send({ error: 'Countermeasure not found' });

      const surveyRating = t.vulnerabilityRating ?? cm.surveyRatingAtCreation ?? null;
      const surveyNumeric = surveyRating ? vulnerabilityRatingToNumeric(surveyRating) : null;

      const updated = await prisma.countermeasure.update({
        where: { id: cm.id },
        data: {
          assignedToThreatId: req.params.threatId,
          isExisting: true,
          surveyRatingAtCreation: cm.surveyRatingAtCreation ?? surveyRating ?? undefined,
          surveyRatingNumeric: surveyNumeric ?? undefined,
        },
        include: {
          assignedToAsset: { select: { id: true, name: true } },
          assignedToThreat: {
            select: {
              id: true, adversaryType: true, actionType: true,
              targetAsset: { select: { name: true } },
            },
          },
        },
      });
      return toCountermeasureDetail(updated);
    },
  );

  // ── CREATE GAP (explicit "no control" or coverage flag) ─
  router.post(
    '/:id/threats/:threatId/gaps',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Record an explicit CountermeasureGap for a threat (Step 6)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: createGapSchema,
        response: { 201: countermeasureGapSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const a = await loadScopedAssessment(req.params.id, tenantId);
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const t = await prisma.threat.findFirst({
        where: { id: req.params.threatId, assessmentId: a.id },
        select: { id: true, irv: true },
      });
      if (!t) return reply.code(404).send({ error: 'Threat not found' });

      const created = await prisma.countermeasureGap.create({
        data: {
          tenantId,
          assessmentId: a.id,
          threatId: t.id,
          countermeasureId: req.body.countermeasureId ?? null,
          gapType: req.body.gapType,
          gapSeverity: gapSeverityFromIrv(t.irv, null),
          description: req.body.description,
          recommendedAction: req.body.recommendedAction ?? null,
          drivesTreatmentPriority: req.body.drivesTreatmentPriority,
          createdById: sub,
        },
        include: { countermeasure: { select: { name: true } } },
      });

      return reply.code(201).send({
        id: created.id,
        assessmentId: created.assessmentId,
        threatId: created.threatId,
        countermeasureId: created.countermeasureId,
        countermeasureName: created.countermeasure?.name ?? null,
        gapType: created.gapType,
        gapSeverity: created.gapSeverity,
        description: created.description,
        recommendedAction: created.recommendedAction,
        drivesTreatmentPriority: created.drivesTreatmentPriority,
        isOpen: created.isOpen,
        closedAt: null,
        closingNotes: null,
        createdAt: created.createdAt.toISOString(),
      });
    },
  );

  // ── CLOSE GAP ────────────────────────────────────────────
  router.patch(
    '/:id/gaps/:gapId/close',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['assessments'],
        summary: 'Close an open CountermeasureGap with optional notes',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, gapId: uuid }),
        body: closeGapSchema,
        response: { 200: countermeasureGapSummarySchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const gap = await prisma.countermeasureGap.findFirst({
        where: { id: req.params.gapId, assessmentId: req.params.id, tenantId },
        select: { id: true, isOpen: true },
      });
      if (!gap) return reply.code(404).send({ error: 'Gap not found' });
      if (!gap.isOpen) return reply.code(409).send({ error: 'Gap is already closed' });

      const updated = await prisma.countermeasureGap.update({
        where: { id: gap.id },
        data: {
          isOpen: false,
          closedAt: new Date(),
          closedById: sub,
          closingNotes: req.body.closingNotes ?? null,
        },
        include: { countermeasure: { select: { name: true } } },
      });

      return {
        id: updated.id,
        assessmentId: updated.assessmentId,
        threatId: updated.threatId,
        countermeasureId: updated.countermeasureId,
        countermeasureName: updated.countermeasure?.name ?? null,
        gapType: updated.gapType,
        gapSeverity: updated.gapSeverity,
        description: updated.description,
        recommendedAction: updated.recommendedAction,
        drivesTreatmentPriority: updated.drivesTreatmentPriority,
        isOpen: updated.isOpen,
        closedAt: updated.closedAt ? updated.closedAt.toISOString() : null,
        closingNotes: updated.closingNotes,
        createdAt: updated.createdAt.toISOString(),
      };
    },
  );
}

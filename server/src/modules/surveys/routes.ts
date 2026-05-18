import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  surveyTypeEnum,
  surveyStatusEnum,
  surveyResponseSummarySchema,
  surveyResponseDetailSchema,
  surveyResponseListResponseSchema,
  surveyResponseCreateSchema,
  surveyResponseUpdateSchema,
  surveyResponseFromScopeSchema,
  surveyTemplateContentSchema,
} from './schema.js';
import { scoreSurveyResponse, type TemplateContent } from './scoring.js';
import { scoreAndPersistAaaResponse } from './aaa-scoring.js';
import { refreshAssessmentEvidenceBasis } from '../assessments/evidence.js';
import { diffSurveyResponses, topSeverity } from './diff.js';
import { asBuiltInOverrides } from '../admin/survey-config.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

import type { JwtPayload } from '../../lib/jwt.js';
import { getInstanceOrg } from '../../lib/instance-org.js';

type ResponseRow = Prisma.SurveyResponseGetPayload<{
  include: {
    cluster: { select: { name: true } };
    template: { select: { name: true } };
    scope: { select: { name: true } };
    conductedBy: { select: { firstName: true; lastName: true } };
  };
}>;

function summary(r: ResponseRow) {
  return {
    id: r.id,
    clusterId: r.clusterId,
    clusterName: r.cluster?.name ?? null,
    templateId: r.templateId,
    templateName: r.template?.name ?? null,
    clusterSurveyScopeId: r.clusterSurveyScopeId,
    scopeName: r.scope?.name ?? null,
    surveyType: r.surveyType,
    conductedById: r.conductedById,
    conductedByName: r.conductedBy
      ? `${r.conductedBy.firstName} ${r.conductedBy.lastName}`.trim()
      : null,
    conductedAt: r.conductedAt.toISOString(),
    scorePct: r.scorePct == null ? null : Number(r.scorePct),
    rating: r.rating,
    vulnerabilityScorePct: r.vulnerabilityScorePct == null ? null : Number(r.vulnerabilityScorePct),
    vulnerabilityRating: r.vulnerabilityRating,
    likelihoodScorePct: r.likelihoodScorePct == null ? null : Number(r.likelihoodScorePct),
    likelihoodRating: r.likelihoodRating,
    evidenceSource: r.evidenceSource,
    requiresPhysical: r.requiresPhysical,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const detailInclude = {
  cluster: { select: { name: true } },
  template: true,
  scope: {
    include: {
      items: {
        include: {
          question: true,
          sourceAsset: { select: { name: true } },
          sourceThreat: {
            select: {
              adversaryType: true,
              actionType: true,
              targetAsset: { select: { name: true } },
            },
          },
          sourceCountermeasure: { select: { name: true } },
          sourceCountermeasureTemplate: { select: { name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { addedAt: 'asc' }],
      },
    },
  },
  aaaScores: {
    include: {
      sourceAsset: { select: { name: true } },
      sourceThreat: {
        select: {
          adversaryType: true,
          actionType: true,
          targetAsset: { select: { name: true } },
        },
      },
      sourceCountermeasure: { select: { name: true } },
      sourceCountermeasureTemplate: { select: { name: true } },
    },
  },
  conductedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.SurveyResponseInclude;

type ResponseDetailRow = Prisma.SurveyResponseGetPayload<{ include: typeof detailInclude }>;

type AaaScoreRow = ResponseDetailRow['aaaScores'][number];

function describeAaaSource(row: {
  sourceType: string;
  sourceAsset?: { name: string } | null;
  sourceThreat?: {
    adversaryType: string;
    actionType: string;
    targetAsset?: { name: string } | null;
  } | null;
  sourceCountermeasure?: { name: string } | null;
  sourceCountermeasureTemplate?: { name: string } | null;
}): string {
  switch (row.sourceType) {
    case 'ASSET':
      return row.sourceAsset?.name ? `Asset: ${row.sourceAsset.name}` : 'Asset (deleted)';
    case 'THREAT':
      if (!row.sourceThreat) return 'Threat (deleted)';
      return `Threat: ${row.sourceThreat.adversaryType}/${row.sourceThreat.actionType} → ${row.sourceThreat.targetAsset?.name ?? 'asset'}`;
    case 'COUNTERMEASURE':
      return row.sourceCountermeasure?.name ? `CM: ${row.sourceCountermeasure.name}` : 'CM (deleted)';
    case 'COUNTERMEASURE_GROUP':
      return row.sourceCountermeasureTemplate?.name
        ? `CM group: ${row.sourceCountermeasureTemplate.name}`
        : 'CM group (deleted)';
    case 'MANUAL':
    default:
      return 'Manual';
  }
}

function detail(r: ResponseDetailRow) {
  const base = {
    ...summary(r as unknown as ResponseRow),
    answers: (r.answers ?? {}) as Record<string, unknown>,
    comments: (r.comments ?? {}) as Record<string, string>,
  };

  // Project the answerable question list from EITHER the legacy template's
  // schema OR the scope's items, depending on which one populated the run.
  if (r.scope) {
    const questions = r.scope.items.map((it) => ({
      id: it.id,  // answers are keyed by scope-item id (see aaa-scoring.ts)
      prompt: it.question.prompt,
      type: it.question.type,
      weight: it.weightOverride ?? it.question.defaultWeight,
      hint: it.question.hint,
      options: (it.question.options as string[] | null) ?? undefined,
      severityMap: (it.question.severityMap as Record<string, 'ok' | 'warn' | 'bad'> | null) ?? undefined,
      category: it.question.category,
      evidenceType: it.question.evidenceType,
      source: { sourceType: it.sourceType, label: describeAaaSource(it) },
    }));
    return {
      ...base,
      template: null,
      questions,
      aaaScores: r.aaaScores.map((s: AaaScoreRow) => ({
        sourceType: s.sourceType,
        sourceAssetId: s.sourceAssetId,
        sourceThreatId: s.sourceThreatId,
        sourceCountermeasureId: s.sourceCountermeasureId,
        sourceCountermeasureTemplateId: s.sourceCountermeasureTemplateId,
        sourceLabel: describeAaaSource(s),
        scorePct: s.scorePct == null ? null : Number(s.scorePct),
        rating: s.rating,
        answeredCount: s.answeredCount,
        totalCount: s.totalCount,
      })),
    };
  }

  // Legacy template-based response.
  const t = r.template!;
  const templateSchema = surveyTemplateContentSchema.parse(t.schema);
  return {
    ...base,
    template: {
      id: t.id,
      name: t.name,
      description: t.description,
      surveyType: t.surveyType,
      applicableClusterTypes: t.applicableClusterTypes,
      applicableAssetTypes: t.applicableAssetTypes,
      requiresPhysical: t.requiresPhysical,
      isSystem: t.isSystem,
      isActive: t.isActive,
      updatedAt: t.updatedAt.toISOString(),
      questionCount: templateSchema.questions.length,
      schema: templateSchema,
    },
    questions: templateSchema.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      weight: q.weight,
      hint: q.hint,
      options: q.options,
      severityMap: q.severityMap,
      category: q.category ?? null,
      evidenceType: t.surveyType,
      source: null,
    })),
    aaaScores: [],
  };
}

export default async function surveyResponseRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── ENABLED TYPES (read-only for any surveys:read user) ───
  router.get(
    '/enabled-types',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['surveys'],
        summary: 'List survey types enabled for this tenant (read-only)',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            enabledTypes: z.array(z.string()),
            customTypes: z.array(z.object({
              code: z.string(),
              name: z.string(),
              description: z.string().nullable().optional(),
              requiresPhysical: z.boolean(),
            })),
            builtInOverrides: z.array(z.object({
              code: z.enum(['PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID']),
              name: z.string().optional(),
              description: z.string().optional(),
              requiresPhysical: z.boolean().optional(),
            })),
          }),
        },
      },
    },
    async () => {
      const org = await getInstanceOrg();
      const row = await prisma.organizationSurveyConfig.findUnique({ where: { organizationId: org.id } });
      if (!row) {
        return {
          enabledTypes: ['PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID', 'CUSTOM'],
          customTypes: [],
          builtInOverrides: [],
        };
      }
      const raw = row.customTypes as unknown;
      const customTypes = Array.isArray(raw)
        ? raw
            .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
            .map((c) => ({
              code: String(c.code ?? ''),
              name: String(c.name ?? ''),
              description: typeof c.description === 'string' ? c.description : null,
              requiresPhysical: Boolean(c.requiresPhysical ?? false),
            }))
            .filter((c) => c.code && c.name)
        : [];
      const builtInOverrides = asBuiltInOverrides(row.builtInOverrides);
      return { enabledTypes: row.enabledTypes, customTypes, builtInOverrides };
    },
  );

  // ── LIST ──────────────────────────────────────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['surveys'],
        summary: 'List survey responses (scoped to tenant)',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          clusterId: uuid.optional(),
          status: surveyStatusEnum.optional(),
          surveyType: surveyTypeEnum.optional(),
        }),
        response: { 200: surveyResponseListResponseSchema },
      },
    },
    async (req) => {
      const where: Prisma.SurveyResponseWhereInput = {
        ...(req.query.clusterId ? { clusterId: req.query.clusterId } : {}),
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(req.query.surveyType ? { surveyType: req.query.surveyType } : {}),
      };
      const items = await prisma.surveyResponse.findMany({
        where,
        include: {
          cluster: { select: { name: true } },
          template: { select: { name: true } },
          scope: { select: { name: true } },
          conductedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ conductedAt: 'desc' }],
      });
      return { items: items.map(summary) };
    },
  );

  // ── DETAIL ────────────────────────────────────────────────
  router.get(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['surveys'],
        summary: 'Get survey response with embedded template',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: surveyResponseDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const r = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id },
        include: detailInclude,
      });
      if (!r) return reply.code(404).send({ error: 'Survey response not found' });
      return detail(r);
    },
  );

  // ── CREATE (DRAFT) ────────────────────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:write')],
      schema: {
        tags: ['surveys'],
        summary: 'Create a DRAFT survey response',
        security: [{ bearerAuth: [] }],
        body: surveyResponseCreateSchema,
        response: { 201: surveyResponseDetailSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;

      const cluster = await prisma.assetCluster.findFirst({
        where: { id: req.body.clusterId },
      });
      if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });

      const template = await prisma.surveyTemplate.findFirst({
        where: {
          id: req.body.templateId,
          isActive: true,
        },
      });
      if (!template) return reply.code(404).send({ error: 'Template not found or inactive' });

      const created = await prisma.surveyResponse.create({
        data: {
          clusterId: req.body.clusterId,
          templateId: template.id,
          surveyType: template.surveyType,
          conductedById: sub,
          conductedAt: req.body.conductedAt ? new Date(req.body.conductedAt) : new Date(),
          evidenceSource: req.body.evidenceSource ?? null,
          requiresPhysical: template.requiresPhysical,
          answers: req.body.answers as Prisma.InputJsonValue,
          status: 'DRAFT',
        },
        include: detailInclude,
      });
      return reply.code(201).send(detail(created));
    },
  );

  // ── CREATE FROM SCOPE (DRAFT, AAA-driven) ─────────────────
  router.post(
    '/from-scope',
    {
      onRequest: [app.authenticate, requirePermission('surveys:write')],
      schema: {
        tags: ['surveys'],
        summary: 'Start a DRAFT survey response from an APPROVED ClusterSurveyScope',
        security: [{ bearerAuth: [] }],
        body: surveyResponseFromScopeSchema,
        response: { 201: surveyResponseDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const scope = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.body.scopeId },
        include: { _count: { select: { items: true } } },
      });
      if (!scope) return reply.code(404).send({ error: 'Scope not found' });
      if (scope.status !== 'APPROVED') {
        return reply.code(409).send({ error: 'Only APPROVED scopes can be run' });
      }
      if (scope._count.items === 0) {
        return reply.code(409).send({ error: 'Scope has no items' });
      }
      const primaryEvidenceType = scope.evidenceTypes[0] ?? 'CUSTOM';
      const requiresPhysical = scope.evidenceTypes.includes('PHYSICAL') || scope.evidenceTypes.includes('HYBRID');

      const created = await prisma.surveyResponse.create({
        data: {
          clusterId: scope.clusterId,
          templateId: null,
          clusterSurveyScopeId: scope.id,
          surveyType: primaryEvidenceType,
          conductedById: sub,
          conductedAt: req.body.conductedAt ? new Date(req.body.conductedAt) : new Date(),
          evidenceSource: req.body.evidenceSource ?? null,
          requiresPhysical,
          answers: {} as Prisma.InputJsonValue,
          status: 'DRAFT',
        },
        include: detailInclude,
      });
      return reply.code(201).send(detail(created));
    },
  );

  // ── UPDATE (answers / evidenceSource while DRAFT) ─────────
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:write')],
      schema: {
        tags: ['surveys'],
        summary: 'Update a DRAFT survey response',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: surveyResponseUpdateSchema,
        response: { 200: surveyResponseDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'Survey response not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT responses can be edited' });
      }

      const data: Prisma.SurveyResponseUpdateInput = {};
      if (req.body.answers !== undefined) data.answers = req.body.answers as Prisma.InputJsonValue;
      if (req.body.comments !== undefined) {
        data.comments = req.body.comments as Prisma.InputJsonValue;
      }
      if (req.body.evidenceSource !== undefined) {
        data.evidenceSource = req.body.evidenceSource;
      }

      const updated = await prisma.surveyResponse.update({
        where: { id: existing.id },
        data,
        include: detailInclude,
      });
      return detail(updated);
    },
  );

  // ── SUBMIT (DRAFT → SUBMITTED, scores, recomputes evidence) ─
  router.post(
    '/:id/submit',
    {
      onRequest: [app.authenticate, requirePermission('surveys:write')],
      schema: {
        tags: ['surveys'],
        summary: 'Submit a DRAFT response (scores it; recomputes evidence basis on linked assessments)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: surveyResponseDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id },
        include: { template: true, linkedAssessments: { select: { assessmentId: true } } },
      });
      if (!existing) return reply.code(404).send({ error: 'Survey response not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT responses can be submitted' });
      }

      // Dispatch on whether this is a scope-based AAA run or a legacy template run.
      if (existing.clusterSurveyScopeId) {
        await scoreAndPersistAaaResponse(existing.id);
        await prisma.surveyResponse.update({
          where: { id: existing.id },
          data: { status: 'SUBMITTED' },
        });
        for (const link of existing.linkedAssessments) {
          try {
            await refreshAssessmentEvidenceBasis(link.assessmentId);
          } catch (err) {
            req.log.error({ err, assessmentId: link.assessmentId }, 'evidence refresh failed');
          }
        }
        const finalRow = await prisma.surveyResponse.findUnique({
          where: { id: existing.id },
          include: detailInclude,
        });
        return detail(finalRow!);
      }

      // ── Legacy template-based path (unchanged) ───────────
      if (!existing.template) {
        return reply.code(409).send({ error: 'Response has neither template nor scope; cannot score' });
      }
      const parsed = surveyTemplateContentSchema.safeParse(existing.template.schema);
      if (!parsed.success) {
        return reply.code(409).send({ error: 'Template schema is invalid; cannot score' });
      }
      const content: TemplateContent = parsed.data;
      const scored = scoreSurveyResponse(content, existing.answers as Record<string, unknown>);

      const updated = await prisma.surveyResponse.update({
        where: { id: existing.id },
        data: {
          status: 'SUBMITTED',
          scorePct: scored.scorePct ?? null,
          rating: scored.rating ?? null,
        },
        include: detailInclude,
      });

      // Recompute evidence basis for every linked assessment.
      for (const link of existing.linkedAssessments) {
        try {
          await refreshAssessmentEvidenceBasis(link.assessmentId);
        } catch (err) {
          req.log.error({ err, assessmentId: link.assessmentId }, 'evidence refresh failed');
        }
      }

      // P3 — drift detection vs most-recent prior SUBMITTED/APPROVED response
      // for the same (clusterId, templateId). Non-INFO drifts fan
      // out a SURVEY_DRIFT notification to submitter + ORG_ADMINs.
      try {
        const previous = await prisma.surveyResponse.findFirst({
          where: {
            clusterId: updated.clusterId,
            templateId: updated.templateId,
            id: { not: updated.id },
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
          orderBy: { conductedAt: 'desc' },
          select: { id: true, answers: true, scorePct: true, rating: true, conductedAt: true },
        });
        if (previous) {
          const diffs = diffSurveyResponses(
            content,
            {
              answers: (previous.answers ?? {}) as Record<string, unknown>,
              scorePct: previous.scorePct == null ? null : Number(previous.scorePct),
              rating: previous.rating,
            },
            {
              answers: (updated.answers ?? {}) as Record<string, unknown>,
              scorePct: updated.scorePct == null ? null : Number(updated.scorePct),
              rating: updated.rating,
            },
          );
          const severity = topSeverity(diffs);
          if (diffs.length > 0 && severity !== 'INFO') {
            const admins = await prisma.user.findMany({
              where: { role: 'ADMIN', isActive: true },
              select: { id: true },
            });
            const recipients = new Set<string>([
              updated.conductedById,
              ...admins.map((a) => a.id),
            ]);
            const title = `Survey drift: ${updated.template?.name ?? 'survey'} for ${updated.cluster?.name ?? 'cluster'}`;
            const body = `${diffs.length} change(s) detected vs previous submission.`;
            for (const uid of recipients) {
              await prisma.notification.create({
                data: {
                  userId: uid,
                  kind: 'SURVEY_DRIFT',
                  severity,
                  title,
                  body,
                  payload: JSON.parse(
                    JSON.stringify({
                      surveyResponseId: updated.id,
                      previousResponseId: previous.id,
                      clusterId: updated.clusterId,
                      diffs,
                    }),
                  ),
                },
              });
            }
          }
        }
      } catch (err) {
        req.log.error({ err, surveyId: updated.id }, 'drift detection failed');
      }

      return detail(updated);
    },
  );

  // ── DELETE (DRAFT only) ───────────────────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:write')],
      schema: {
        tags: ['surveys'],
        summary: 'Delete a DRAFT survey response',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'Survey response not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT responses can be deleted' });
      }
      await prisma.surveyResponse.delete({ where: { id: existing.id } });
      return reply.code(204).send();
    },
  );

  // ── DRIFT (vs previous SUBMITTED/APPROVED response on same cluster+template) ─
  router.get(
    '/:id/drift',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['surveys'],
        summary: 'Diff this response against the previous SUBMITTED/APPROVED one',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: {
          200: z.object({
            hasPrevious: z.boolean(),
            previousResponseId: z.string().uuid().nullable(),
            previousConductedAt: z.string().nullable(),
            topSeverity: z.enum(['INFO', 'WARN', 'CRITICAL']).nullable(),
            diffs: z.array(z.object({
              questionId: z.string(),
              prompt: z.string(),
              from: z.unknown().nullable(),
              to: z.unknown().nullable(),
              severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
              reason: z.string(),
            })),
          }),
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const current = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id },
        include: { template: true },
      });
      if (!current) return reply.code(404).send({ error: 'Survey response not found' });

      // Drift detection only applies to legacy template-based runs.
      // Scope-based runs have their own per-AAA score history surfaced
      // separately and are not yet wired into this diff path.
      if (!current.template || current.templateId == null) {
        return {
          hasPrevious: false,
          previousResponseId: null,
          previousConductedAt: null,
          topSeverity: null,
          diffs: [],
        };
      }

      const previous = await prisma.surveyResponse.findFirst({
        where: {
          clusterId: current.clusterId,
          templateId: current.templateId,
          id: { not: current.id },
          status: { in: ['SUBMITTED', 'APPROVED'] },
          conductedAt: { lt: current.conductedAt },
        },
        orderBy: { conductedAt: 'desc' },
        select: { id: true, answers: true, scorePct: true, rating: true, conductedAt: true },
      });

      if (!previous) {
        return {
          hasPrevious: false,
          previousResponseId: null,
          previousConductedAt: null,
          topSeverity: null,
          diffs: [],
        };
      }

      const parsed = surveyTemplateContentSchema.safeParse(current.template.schema);
      if (!parsed.success) {
        return {
          hasPrevious: true,
          previousResponseId: previous.id,
          previousConductedAt: previous.conductedAt.toISOString(),
          topSeverity: null,
          diffs: [],
        };
      }
      const content: TemplateContent = parsed.data;
      const entries = diffSurveyResponses(content, {
        answers: (previous.answers ?? {}) as Record<string, unknown>,
        scorePct: previous.scorePct == null ? null : Number(previous.scorePct),
        rating: previous.rating,
      }, {
        answers: (current.answers ?? {}) as Record<string, unknown>,
        scorePct: current.scorePct == null ? null : Number(current.scorePct),
        rating: current.rating,
      });
      const severity = entries.length === 0 ? 'INFO' : topSeverity(entries);
      return {
        hasPrevious: true,
        previousResponseId: previous.id,
        previousConductedAt: previous.conductedAt.toISOString(),
        topSeverity: severity,
        diffs: entries,
      };
    },
  );
}

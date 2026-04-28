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
  surveyTemplateContentSchema,
} from './schema.js';
import { scoreSurveyResponse, type TemplateContent } from './scoring.js';
import { refreshAssessmentEvidenceBasis } from '../assessments/evidence.js';
import { diffSurveyResponses, topSeverity } from './diff.js';
import { asBuiltInOverrides } from '../admin/survey-config.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

type ResponseRow = Prisma.SurveyResponseGetPayload<{
  include: {
    cluster: { select: { name: true } };
    template: { select: { name: true } };
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
    surveyType: r.surveyType,
    conductedById: r.conductedById,
    conductedByName: r.conductedBy
      ? `${r.conductedBy.firstName} ${r.conductedBy.lastName}`.trim()
      : null,
    conductedAt: r.conductedAt.toISOString(),
    scorePct: r.scorePct == null ? null : Number(r.scorePct),
    rating: r.rating,
    evidenceSource: r.evidenceSource,
    requiresPhysical: r.requiresPhysical,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const detailInclude = {
  cluster: { select: { name: true } },
  template: true,
  conductedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.SurveyResponseInclude;

type ResponseDetailRow = Prisma.SurveyResponseGetPayload<{ include: typeof detailInclude }>;

function detail(r: ResponseDetailRow) {
  const t = r.template;
  const templateSchema = surveyTemplateContentSchema.parse(t.schema);
  return {
    ...summary(r as unknown as ResponseRow),
    answers: (r.answers ?? {}) as Record<string, unknown>,
    template: {
      id: t.id,
      tenantId: t.tenantId,
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
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const row = await prisma.tenantSurveyConfig.findUnique({ where: { tenantId } });
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
      const { tenantId } = req.user as JwtPayload;
      const where: Prisma.SurveyResponseWhereInput = {
        tenantId,
        ...(req.query.clusterId ? { clusterId: req.query.clusterId } : {}),
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(req.query.surveyType ? { surveyType: req.query.surveyType } : {}),
      };
      const items = await prisma.surveyResponse.findMany({
        where,
        include: {
          cluster: { select: { name: true } },
          template: { select: { name: true } },
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
      const { tenantId } = req.user as JwtPayload;
      const r = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id, tenantId },
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
      const { sub, tenantId } = req.user as JwtPayload;

      const cluster = await prisma.assetCluster.findFirst({
        where: { id: req.body.clusterId, tenantId },
      });
      if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });

      const template = await prisma.surveyTemplate.findFirst({
        where: {
          id: req.body.templateId,
          OR: [{ tenantId: null }, { tenantId }],
          isActive: true,
        },
      });
      if (!template) return reply.code(404).send({ error: 'Template not found or inactive' });

      const created = await prisma.surveyResponse.create({
        data: {
          tenantId,
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
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Survey response not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT responses can be edited' });
      }

      const data: Prisma.SurveyResponseUpdateInput = {};
      if (req.body.answers !== undefined) data.answers = req.body.answers as Prisma.InputJsonValue;
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
      const { tenantId } = req.user as JwtPayload;

      const existing = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id, tenantId },
        include: { template: true, linkedAssessments: { select: { assessmentId: true } } },
      });
      if (!existing) return reply.code(404).send({ error: 'Survey response not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT responses can be submitted' });
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
      // for the same (tenantId, clusterId, templateId). Non-INFO drifts fan
      // out a SURVEY_DRIFT notification to submitter + ORG_ADMINs.
      try {
        const previous = await prisma.surveyResponse.findFirst({
          where: {
            tenantId,
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
              where: { tenantId, role: 'ADMIN', isActive: true },
              select: { id: true },
            });
            const recipients = new Set<string>([
              updated.conductedById,
              ...admins.map((a) => a.id),
            ]);
            const title = `Survey drift: ${updated.template.name} for ${updated.cluster?.name ?? 'cluster'}`;
            const body = `${diffs.length} change(s) detected vs previous submission.`;
            for (const uid of recipients) {
              await prisma.notification.create({
                data: {
                  tenantId,
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
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id, tenantId },
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
      const { tenantId } = req.user as JwtPayload;
      const current = await prisma.surveyResponse.findFirst({
        where: { id: req.params.id, tenantId },
        include: { template: true },
      });
      if (!current) return reply.code(404).send({ error: 'Survey response not found' });

      const previous = await prisma.surveyResponse.findFirst({
        where: {
          tenantId,
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

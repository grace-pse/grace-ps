// Library CRUD for SurveyQuestion. Questions are reusable across asset/threat/
// countermeasure templates and across cluster survey scopes. System questions
// (isSystem=true) are visible to everyone but read-only; non-system questions
// are editable.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import type { JwtPayload } from '../../lib/jwt.js';
import {
  surveyQuestionCreateSchema,
  surveyQuestionUpdateSchema,
  surveyQuestionSummarySchema,
  surveyQuestionListResponseSchema,
} from './questions-schema.js';
import { surveyTypeEnum } from './schema.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type QuestionRow = Prisma.SurveyQuestionGetPayload<{
  include: {
    _count: {
      select: {
        assetTemplateLinks: true;
        threatTemplateLinks: true;
        countermeasureTemplateLinks: true;
      };
    };
  };
}>;

function summary(q: QuestionRow) {
  return {
    id: q.id,
    prompt: q.prompt,
    category: q.category,
    hint: q.hint,
    type: q.type,
    options: (q.options as string[] | null) ?? null,
    severityMap: (q.severityMap as Record<string, 'ok' | 'warn' | 'bad'> | null) ?? null,
    evidenceType: q.evidenceType,
    defaultWeight: q.defaultWeight,
    isSystem: q.isSystem,
    isActive: q.isActive,
    attachedTemplateCount:
      q._count.assetTemplateLinks + q._count.threatTemplateLinks + q._count.countermeasureTemplateLinks,
    updatedAt: q.updatedAt.toISOString(),
  };
}

const includeCounts = {
  _count: {
    select: {
      assetTemplateLinks: true,
      threatTemplateLinks: true,
      countermeasureTemplateLinks: true,
    },
  },
} satisfies Prisma.SurveyQuestionInclude;

export default async function surveyQuestionRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST ──────────────────────────────────────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['surveys'],
        summary: 'List survey questions (system + instance-owned)',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          evidenceType: surveyTypeEnum.optional(),
          search: z.string().trim().max(120).optional(),
          includeInactive: z.enum(['true', 'false']).optional(),
        }),
        response: { 200: surveyQuestionListResponseSchema },
      },
    },
    async (req) => {
      const where: Prisma.SurveyQuestionWhereInput = {
        ...(req.query.evidenceType ? { evidenceType: req.query.evidenceType } : {}),
        ...(req.query.search
          ? {
              OR: [
                { prompt: { contains: req.query.search, mode: 'insensitive' } },
                { category: { contains: req.query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(req.query.includeInactive === 'true' ? {} : { isActive: true }),
      };
      const items = await prisma.surveyQuestion.findMany({
        where,
        include: includeCounts,
        orderBy: [{ isSystem: 'desc' }, { prompt: 'asc' }],
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
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: surveyQuestionSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const q = await prisma.surveyQuestion.findFirst({
        where: { id: req.params.id },
        include: includeCounts,
      });
      if (!q) return reply.code(404).send({ error: 'Question not found' });
      return summary(q);
    },
  );

  // ── CREATE ────────────────────────────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['surveys'],
        summary: 'Create a survey question',
        security: [{ bearerAuth: [] }],
        body: surveyQuestionCreateSchema,
        response: { 201: surveyQuestionSummarySchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const created = await prisma.surveyQuestion.create({
        data: {
          createdById: sub,
          prompt: req.body.prompt,
          category: req.body.category ?? null,
          hint: req.body.hint ?? null,
          type: req.body.type,
          options: (req.body.options ?? null) as Prisma.InputJsonValue | null ?? undefined,
          severityMap: (req.body.severityMap ?? null) as Prisma.InputJsonValue | null ?? undefined,
          evidenceType: req.body.evidenceType,
          defaultWeight: req.body.defaultWeight,
          isSystem: false,
          isActive: true,
        },
        include: includeCounts,
      });
      return reply.code(201).send(summary(created));
    },
  );

  // ── UPDATE (non-system only — system locked) ─────────────
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['surveys'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: surveyQuestionUpdateSchema,
        response: { 200: surveyQuestionSummarySchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.surveyQuestion.findFirst({
        where: { id: req.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'Question not found' });
      if (existing.isSystem) return reply.code(409).send({ error: 'system_question_locked' });

      const b = req.body;
      const data: Prisma.SurveyQuestionUpdateInput = {
        ...(b.prompt !== undefined ? { prompt: b.prompt } : {}),
        ...(b.category !== undefined ? { category: b.category } : {}),
        ...(b.hint !== undefined ? { hint: b.hint } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.options !== undefined ? { options: (b.options ?? null) as Prisma.InputJsonValue | null ?? undefined } : {}),
        ...(b.severityMap !== undefined
          ? { severityMap: (b.severityMap ?? null) as Prisma.InputJsonValue | null ?? undefined }
          : {}),
        ...(b.evidenceType !== undefined ? { evidenceType: b.evidenceType } : {}),
        ...(b.defaultWeight !== undefined ? { defaultWeight: b.defaultWeight } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
      };
      const updated = await prisma.surveyQuestion.update({
        where: { id: existing.id },
        data,
        include: includeCounts,
      });
      return summary(updated);
    },
  );

  // ── DELETE (non-system only) ──────────────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['surveys'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.surveyQuestion.findFirst({
        where: { id: req.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'Question not found' });
      if (existing.isSystem) return reply.code(409).send({ error: 'system_question_locked' });

      // Block deletion if any APPROVED scope items still reference this question.
      const refUsage = await prisma.clusterSurveyScopeItem.count({
        where: { questionId: existing.id, scope: { status: 'APPROVED' } },
      });
      if (refUsage > 0) {
        return reply.code(409).send({
          error: 'question_in_use_by_approved_scope',
        });
      }
      await prisma.surveyQuestion.delete({ where: { id: existing.id } });
      return reply.code(204).send();
    },
  );
}

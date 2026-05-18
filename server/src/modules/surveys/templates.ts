import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import type { JwtPayload } from '../../lib/jwt.js';
import {
  surveyTemplateSummarySchema,
  surveyTemplateDetailSchema,
  surveyTemplateListResponseSchema,
  surveyTemplateCreateSchema,
  surveyTemplateUpdateSchema,
  surveyTemplateForkSchema,
  surveyTemplateContentSchema,
  surveyTypeEnum,
} from './schema.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

function toSummary(t: any) {
  const schema = (t.schema ?? { questions: [] }) as { questions?: unknown[] };
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    surveyType: t.surveyType,
    applicableClusterTypes: t.applicableClusterTypes ?? [],
    applicableAssetTypes: t.applicableAssetTypes ?? [],
    requiresPhysical: t.requiresPhysical,
    isSystem: t.isSystem,
    isActive: t.isActive,
    questionCount: Array.isArray(schema.questions) ? schema.questions.length : 0,
    updatedAt: t.updatedAt.toISOString(),
  };
}

function toDetail(t: any) {
  return {
    ...toSummary(t),
    schema: t.schema,
  };
}

export default async function surveyTemplateRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST ──────────────────────────────────────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['survey-templates'],
        summary: 'List survey templates (system + instance-owned)',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          surveyType: surveyTypeEnum.optional(),
          activeOnly: z.coerce.boolean().optional(),
        }),
        response: { 200: surveyTemplateListResponseSchema },
      },
    },
    async (req) => {
      const where: Prisma.SurveyTemplateWhereInput = {
        ...(req.query.surveyType ? { surveyType: req.query.surveyType } : {}),
        ...(req.query.activeOnly ? { isActive: true } : {}),
      };
      const items = await prisma.surveyTemplate.findMany({
        where,
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      });
      return { items: items.map(toSummary) };
    },
  );

  // ── DETAIL ────────────────────────────────────────────────
  router.get(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Get survey template with full question schema',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: surveyTemplateDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id },
      });
      if (!t) return reply.code(404).send({ error: 'Template not found' });
      return toDetail(t);
    },
  );

  // ── CREATE (ADMIN only) ───────────────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Create an instance-owned survey template',
        security: [{ bearerAuth: [] }],
        body: surveyTemplateCreateSchema,
        response: { 201: surveyTemplateDetailSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const created = await prisma.surveyTemplate.create({
        data: {
          createdById: sub,
          name: req.body.name,
          description: req.body.description ?? null,
          surveyType: req.body.surveyType,
          applicableClusterTypes: req.body.applicableClusterTypes,
          applicableAssetTypes: req.body.applicableAssetTypes,
          requiresPhysical: req.body.requiresPhysical,
          isSystem: false,
          isActive: true,
          schema: req.body.schema,
        },
      });
      return reply.code(201).send(toDetail(created));
    },
  );

  // ── UPDATE (ADMIN only; non-system only) ──────────────────
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Update a non-system survey template',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: surveyTemplateUpdateSchema,
        response: { 200: surveyTemplateDetailSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id, isSystem: false },
      });
      if (!t) return reply.code(404).send({ error: 'Template not found (or read-only system template)' });

      const updated = await prisma.surveyTemplate.update({
        where: { id: t.id },
        data: {
          ...(req.body.name !== undefined ? { name: req.body.name } : {}),
          ...(req.body.description !== undefined ? { description: req.body.description ?? null } : {}),
          ...(req.body.surveyType ? { surveyType: req.body.surveyType } : {}),
          ...(req.body.applicableClusterTypes ? { applicableClusterTypes: req.body.applicableClusterTypes } : {}),
          ...(req.body.applicableAssetTypes ? { applicableAssetTypes: req.body.applicableAssetTypes } : {}),
          ...(req.body.requiresPhysical !== undefined ? { requiresPhysical: req.body.requiresPhysical } : {}),
          ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
          ...(req.body.schema ? { schema: req.body.schema } : {}),
        },
      });
      return toDetail(updated);
    },
  );

  // ── FORK (any template → new non-system copy) ─────────────
  router.post(
    '/:id/fork',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Fork a template into a new non-system editable copy',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: surveyTemplateForkSchema,
        response: { 201: surveyTemplateDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const source = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id },
      });
      if (!source) return reply.code(404).send({ error: 'Template not found' });

      const created = await prisma.surveyTemplate.create({
        data: {
          createdById: sub,
          name: req.body.name ?? `${source.name} (fork)`,
          description: source.description,
          surveyType: source.surveyType,
          applicableClusterTypes: source.applicableClusterTypes,
          applicableAssetTypes: source.applicableAssetTypes,
          requiresPhysical: source.requiresPhysical,
          isSystem: false,
          isActive: true,
          schema: source.schema as Prisma.InputJsonValue,
        },
      });
      return reply.code(201).send(toDetail(created));
    },
  );

  // ── DELETE (non-system only) ──────────────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Delete a non-system survey template',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id, isSystem: false },
      });
      if (!t) return reply.code(404).send({ error: 'Template not found (or read-only system template)' });

      const inUse = await prisma.surveyResponse.count({ where: { templateId: t.id } });
      if (inUse > 0) {
        return reply.code(409).send({
          error: `Template is used by ${inUse} survey response(s); archive (set isActive=false) instead of deleting.`,
        });
      }
      await prisma.surveyTemplate.delete({ where: { id: t.id } });
      return reply.code(204).send();
    },
  );
}

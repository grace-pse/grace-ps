import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
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

type JwtPayload = { sub: string; tenantId: string; role: string };

type TemplateRow = Prisma.SurveyTemplateGetPayload<{ select: Record<string, unknown> }>;

function toSummary(t: any) {
  const schema = (t.schema ?? { questions: [] }) as { questions?: unknown[] };
  return {
    id: t.id,
    tenantId: t.tenantId ?? null,
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

  // ── LIST (system + own tenant templates) ──────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['survey-templates'],
        summary: 'List system + tenant survey templates',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          surveyType: surveyTypeEnum.optional(),
          activeOnly: z.coerce.boolean().optional(),
        }),
        response: { 200: surveyTemplateListResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const where: Prisma.SurveyTemplateWhereInput = {
        OR: [{ tenantId: null }, { tenantId }],
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
      const { tenantId } = req.user as JwtPayload;
      const t = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id, OR: [{ tenantId: null }, { tenantId }] },
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
        summary: 'Create a tenant-scoped survey template',
        security: [{ bearerAuth: [] }],
        body: surveyTemplateCreateSchema,
        response: { 201: surveyTemplateDetailSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub, tenantId } = req.user as JwtPayload;
      const created = await prisma.surveyTemplate.create({
        data: {
          tenantId,
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

  // ── UPDATE (ADMIN only; own-tenant templates only) ────────
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Update a tenant-scoped survey template',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: surveyTemplateUpdateSchema,
        response: { 200: surveyTemplateDetailSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const t = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id, tenantId },
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

  // ── FORK (system → tenant-custom) ─────────────────────────
  router.post(
    '/:id/fork',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Fork a system (or tenant) template into a tenant-scoped editable copy',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: surveyTemplateForkSchema,
        response: { 201: surveyTemplateDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub, tenantId } = req.user as JwtPayload;
      const source = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id, OR: [{ tenantId: null }, { tenantId }] },
      });
      if (!source) return reply.code(404).send({ error: 'Template not found' });

      const created = await prisma.surveyTemplate.create({
        data: {
          tenantId,
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

  // ── DELETE (own-tenant only) ──────────────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['survey-templates'],
        summary: 'Delete a tenant-scoped survey template',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const t = await prisma.surveyTemplate.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!t) return reply.code(404).send({ error: 'Template not found (or read-only system template)' });

      const inUse = await prisma.surveyResponse.count({ where: { templateId: t.id } });
      if (inUse > 0) {
        return reply.code(409).send({
          error: `Template is used by ${inUse} survey response(s); archive (set isActive=false) instead of deleting.`,
        });
      }
      await prisma.surveyTemplate.delete({ where: { id: t.id } });
      return reply.code(204).send(null);
    },
  );
}

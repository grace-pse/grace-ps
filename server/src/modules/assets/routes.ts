import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  assetCreateSchema,
  assetUpdateSchema,
  assetListQuerySchema,
  assetListResponseSchema,
  assetDetailSchema,
  assetSummarySchema,
} from './schema.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

function toSummary(
  a: Prisma.AssetGetPayload<{ include: { _count: { select: { children: true } } } }>,
) {
  return {
    id: a.id,
    name: a.name,
    assetType: a.assetType,
    category: a.category,
    criticality: a.criticality,
    status: a.status,
    parentId: a.parentId,
    tags: a.tags,
    childCount: a._count.children,
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default async function assetRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST ─────────────────────────────────────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['assets'],
        summary: 'List assets in current org',
        security: [{ bearerAuth: [] }],
        querystring: assetListQuerySchema,
        response: { 200: assetListResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const { search, assetType, category, status, parentId, page, pageSize } = req.query;

      const where: Prisma.AssetWhereInput = { tenantId };
      if (assetType) where.assetType = assetType;
      if (category) where.category = category;
      if (status) where.status = status;
      if (parentId === 'none') where.parentId = null;
      else if (parentId) where.parentId = parentId;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          include: { _count: { select: { children: true } } },
          orderBy: [{ updatedAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.asset.count({ where }),
      ]);

      return { items: items.map(toSummary), total, page, pageSize };
    },
  );

  // ── DETAIL ───────────────────────────────────────────────
  router.get(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['assets'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: assetDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const asset = await prisma.asset.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          parent: { select: { id: true, name: true } },
          children: { include: { _count: { select: { children: true } } } },
        },
      });
      if (!asset) return reply.code(404).send({ error: 'Asset not found' });

      return {
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType,
        category: asset.category,
        description: asset.description,
        criticality: asset.criticality,
        status: asset.status,
        parentId: asset.parentId,
        location: asset.location as Record<string, unknown> | null,
        metadata: asset.metadata as Record<string, unknown> | null,
        tags: asset.tags,
        sourceTemplateId: asset.sourceTemplateId,
        createdById: asset.createdById,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
        parent: asset.parent,
        children: asset.children.map(toSummary),
      };
    },
  );

  // ── CREATE ───────────────────────────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['assets'],
        summary: 'Create asset (optionally from template)',
        security: [{ bearerAuth: [] }],
        body: assetCreateSchema,
        response: { 201: assetSummarySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const data = req.body;

      // If template provided, pre-fill missing fields from template
      let templateDefaults: Partial<typeof data> = {};
      if (data.sourceTemplateId) {
        const tpl = await prisma.assetTemplate.findUnique({
          where: { id: data.sourceTemplateId },
        });
        if (!tpl) return reply.code(404).send({ error: 'Template not found' });
        templateDefaults = {
          assetType: tpl.assetType,
          category: tpl.category,
          criticality: tpl.defaultCriticality,
          description: tpl.description ?? undefined,
          tags: tpl.tags,
        };
      }

      if (data.parentId) {
        const parent = await prisma.asset.findFirst({
          where: { id: data.parentId, tenantId },
          select: { id: true },
        });
        if (!parent) return reply.code(404).send({ error: 'Parent asset not found' });
      }

      const created = await prisma.asset.create({
        data: {
          tenantId,
          createdById: sub,
          name: data.name,
          assetType: data.assetType ?? templateDefaults.assetType!,
          category: data.category ?? templateDefaults.category!,
          description: data.description ?? templateDefaults.description ?? null,
          criticality: data.criticality ?? templateDefaults.criticality ?? 3,
          status: data.status,
          parentId: data.parentId ?? null,
          location: (data.location ?? undefined) as Prisma.InputJsonValue | undefined,
          metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
          tags: data.tags.length ? data.tags : (templateDefaults.tags ?? []),
          sourceTemplateId: data.sourceTemplateId ?? null,
        },
        include: { _count: { select: { children: true } } },
      });

      return reply.code(201).send(toSummary(created));
    },
  );

  // ── UPDATE ───────────────────────────────────────────────
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['assets'],
        summary: 'Update asset fields (partial)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: assetUpdateSchema,
        response: { 200: assetSummarySchema, 404: errorSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const { id } = req.params;

      const existing = await prisma.asset.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.code(404).send({ error: 'Asset not found' });

      if (req.body.parentId && req.body.parentId === id) {
        return reply.code(400).send({ error: 'Asset cannot be its own parent' });
      }
      if (req.body.parentId) {
        const parent = await prisma.asset.findFirst({
          where: { id: req.body.parentId, tenantId },
          select: { id: true },
        });
        if (!parent) return reply.code(404).send({ error: 'Parent asset not found' });
      }

      const data: Prisma.AssetUpdateInput = {};
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.assetType !== undefined) data.assetType = req.body.assetType;
      if (req.body.category !== undefined) data.category = req.body.category;
      if (req.body.description !== undefined) data.description = req.body.description;
      if (req.body.criticality !== undefined) data.criticality = req.body.criticality;
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.tags !== undefined) data.tags = req.body.tags;
      if (req.body.location !== undefined)
        data.location = (req.body.location ?? null) as Prisma.InputJsonValue;
      if (req.body.metadata !== undefined)
        data.metadata = (req.body.metadata ?? {}) as Prisma.InputJsonValue;
      if (req.body.parentId !== undefined) {
        data.parent = req.body.parentId
          ? { connect: { id: req.body.parentId } }
          : { disconnect: true };
      }

      const updated = await prisma.asset.update({
        where: { id },
        data,
        include: { _count: { select: { children: true } } },
      });
      return reply.send(toSummary(updated));
    },
  );

  // ── DELETE ───────────────────────────────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assets:delete')],
      schema: {
        tags: ['assets'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: {
          204: z.null(),
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const { id } = req.params;

      const existing = await prisma.asset.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { children: true } } },
      });
      if (!existing) return reply.code(404).send({ error: 'Asset not found' });
      if (existing._count.children > 0) {
        return reply.code(409).send({ error: 'Cannot delete asset with children. Remove or reparent children first.' });
      }

      await prisma.asset.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
}

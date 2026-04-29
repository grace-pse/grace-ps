import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  assetCreateSchema,
  assetUpdateSchema,
  assetCloneSchema,
  assetListQuerySchema,
  assetListResponseSchema,
  assetDetailSchema,
  assetSummarySchema,
  assetRelationshipCreateSchema,
  assetRelationshipSchema,
  assetGraphResponseSchema,
  protectiveCoverageResponseSchema,
} from './schema.js';
import { cloneAssetTree, copyInternalRelationships } from './clone.js';
import { propagateAssetRisk, PROTECTIVE_REL_TYPES } from '../../lib/propagate-asset-risk.js';

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
    assetRole: a.assetRole,
    operationalStatus: a.operationalStatus,
    degradedControlPosture: a.degradedControlPosture,
    degradedControlSince: a.degradedControlSince ? a.degradedControlSince.toISOString() : null,
    parentId: a.parentId,
    tags: a.tags,
    childCount: a._count.children,
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default async function assetRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── GRAPH (static — register before /:id to avoid routing conflict)
  router.get(
    '/graph',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['assets'],
        summary: 'Nodes + edges for relationship graph view',
        security: [{ bearerAuth: [] }],
        response: { 200: assetGraphResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;

      const [assets, relationships] = await Promise.all([
        prisma.asset.findMany({
          where: { tenantId },
          select: {
            id: true, name: true, assetType: true, category: true,
            criticality: true, status: true, parentId: true, assetRole: true,
          },
          orderBy: [{ assetType: 'asc' }, { name: 'asc' }],
        }),
        prisma.assetRelationship.findMany({
          where: { tenantId },
          select: {
            id: true, sourceAssetId: true, targetAssetId: true,
            relationshipType: true, direction: true, impactPropagation: true,
            description: true,
          },
        }),
      ]);

      return { nodes: assets, edges: relationships };
    },
  );

  // ── RELATIONSHIPS: CREATE
  router.post(
    '/relationships',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['assets'],
        summary: 'Create an asset relationship edge',
        security: [{ bearerAuth: [] }],
        body: assetRelationshipCreateSchema,
        response: { 201: assetRelationshipSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const { sourceAssetId, targetAssetId, relationshipType, direction, impactPropagation, description } = req.body;

      if (sourceAssetId === targetAssetId) {
        return reply.code(400).send({ error: 'source and target must differ' });
      }

      const both = await prisma.asset.findMany({
        where: { id: { in: [sourceAssetId, targetAssetId] }, tenantId },
        select: { id: true },
      });
      if (both.length !== 2) return reply.code(404).send({ error: 'asset not found' });

      const rel = await prisma.assetRelationship.create({
        data: {
          tenantId, sourceAssetId, targetAssetId, relationshipType,
          direction, impactPropagation, description: description ?? null,
        },
      });
      return reply.code(201).send({
        id: rel.id,
        sourceAssetId: rel.sourceAssetId,
        targetAssetId: rel.targetAssetId,
        relationshipType: rel.relationshipType,
        direction: rel.direction,
        impactPropagation: rel.impactPropagation,
        description: rel.description,
      });
    },
  );

  // ── RELATIONSHIPS: DELETE
  router.delete(
    '/relationships/:id',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['assets'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.assetRelationship.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'relationship not found' });
      await prisma.assetRelationship.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    },
  );

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
      const {
        search, assetType, category, status, assetRole, operationalStatus,
        degradedControlPosture, parentId, page, pageSize,
      } = req.query;

      const where: Prisma.AssetWhereInput = { tenantId };
      if (assetType) where.assetType = assetType;
      if (category) where.category = category;
      if (status) where.status = status;
      if (assetRole) where.assetRole = assetRole;
      if (operationalStatus) where.operationalStatus = operationalStatus;
      if (degradedControlPosture !== undefined) where.degradedControlPosture = degradedControlPosture;
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

  // ── PROTECTIVE COVERAGE (incoming PROTECTS/MONITORS edges) ─
  router.get(
    '/:id/protective-coverage',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['assets'],
        summary: 'List protective assets covering this asset (PROTECTS/MONITORS).',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: protectiveCoverageResponseSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const { id } = req.params;

      const target = await prisma.asset.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!target) return reply.code(404).send({ error: 'Asset not found' });

      const edges = await prisma.assetRelationship.findMany({
        where: {
          tenantId,
          relationshipType: { in: [...PROTECTIVE_REL_TYPES] },
          OR: [
            { targetAssetId: id },
            { sourceAssetId: id, direction: 'BIDIRECTIONAL' },
          ],
        },
        select: {
          relationshipType: true,
          sourceAssetId: true,
          targetAssetId: true,
          direction: true,
          sourceAsset: {
            select: {
              id: true, name: true, assetType: true, criticality: true,
              operationalStatus: true, degradedControlSince: true,
            },
          },
          targetAsset: {
            select: {
              id: true, name: true, assetType: true, criticality: true,
              operationalStatus: true, degradedControlSince: true,
            },
          },
        },
      });

      const seen = new Set<string>();
      const items: Array<{
        protectiveAssetId: string;
        name: string;
        assetType: typeof edges[number]['sourceAsset']['assetType'];
        criticality: number;
        source: 'EDGE' | 'IMPLICIT_LOCATION';
        relationshipType: 'PROTECTS' | 'MONITORS' | null;
        operationalStatus: typeof edges[number]['sourceAsset']['operationalStatus'];
        degradedSince: string | null;
      }> = [];

      for (const e of edges) {
        const protective = e.sourceAssetId === id ? e.targetAsset : e.sourceAsset;
        if (seen.has(protective.id)) continue;
        seen.add(protective.id);
        items.push({
          protectiveAssetId: protective.id,
          name: protective.name,
          assetType: protective.assetType,
          criticality: protective.criticality,
          source: 'EDGE',
          relationshipType: e.relationshipType as 'PROTECTS' | 'MONITORS',
          operationalStatus: protective.operationalStatus,
          // For PROTECTIVE assets, degradedSince mirrors when operationalStatus
          // last left OPERATIONAL — we reuse degradedControlSince which the
          // propagator maintains symmetrically.
          degradedSince: protective.degradedControlSince
            ? protective.degradedControlSince.toISOString()
            : null,
        });
      }

      // Implicit-location coverage: PROTECTIVE / DUAL assets that live anywhere
      // inside the threat-target's parent_id subtree without an explicit
      // PROTECTS / MONITORS edge. Common pattern — operators add a camera as a
      // child of the floor it covers and don't realise the topology→coverage
      // link isn't automatic. Display-only; ignored by propagateAssetRisk so
      // the §4 bridge invariant stays edge-only.
      let frontier: string[] = [id];
      const subtree = new Set<string>();
      while (frontier.length > 0) {
        const children = await prisma.asset.findMany({
          where: { tenantId, parentId: { in: frontier } },
          select: { id: true },
        });
        const next: string[] = [];
        for (const c of children) {
          if (!subtree.has(c.id)) {
            subtree.add(c.id);
            next.push(c.id);
          }
        }
        frontier = next;
      }
      if (subtree.size > 0) {
        const implicit = await prisma.asset.findMany({
          where: {
            tenantId,
            id: { in: [...subtree], notIn: [...seen] },
            assetRole: { in: ['PROTECTIVE', 'DUAL'] },
          },
          select: {
            id: true, name: true, assetType: true, criticality: true,
            operationalStatus: true, degradedControlSince: true,
          },
          orderBy: [{ name: 'asc' }],
        });
        for (const a of implicit) {
          items.push({
            protectiveAssetId: a.id,
            name: a.name,
            assetType: a.assetType,
            criticality: a.criticality,
            source: 'IMPLICIT_LOCATION',
            relationshipType: null,
            operationalStatus: a.operationalStatus,
            degradedSince: a.degradedControlSince
              ? a.degradedControlSince.toISOString()
              : null,
          });
        }
      }

      return reply.send({ targetAssetId: id, items });
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
        assetRole: asset.assetRole,
        operationalStatus: asset.operationalStatus,
        degradedControlPosture: asset.degradedControlPosture,
        degradedControlSince: asset.degradedControlSince ? asset.degradedControlSince.toISOString() : null,
        parentId: asset.parentId,
        location: asset.location as { lat: number; lng: number; address?: string } | null,
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
          assetRole: data.assetRole,
          operationalStatus: data.operationalStatus,
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

  // ── CLONE ────────────────────────────────────────────────
  router.post(
    '/:id/clone',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['assets'],
        summary: 'Deep-clone an asset (subtree + internal relationships)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: assetCloneSchema,
        response: { 201: assetSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const { id } = req.params;

      const source = await prisma.asset.findFirst({ where: { id, tenantId } });
      if (!source) return reply.code(404).send({ error: 'Asset not found' });

      const result = await prisma.$transaction(async (tx) => {
        const { rootId, idMap } = await cloneAssetTree(tx, {
          sourceId: id,
          tenantId,
          createdById: sub,
          newParentId: source.parentId,
          nameOverride: req.body.name ?? `${source.name} (copy)`,
        });
        await copyInternalRelationships(tx, { tenantId, idMap });
        return tx.asset.findUniqueOrThrow({
          where: { id: rootId },
          include: { _count: { select: { children: true } } },
        });
      });

      return reply.code(201).send(toSummary(result));
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

      const existing = await prisma.asset.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { clusterMemberships: true } } },
      });
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

      // Reclassifying an asset to PROTECTIVE while it sits in clusters would
      // contradict the cluster-membership rule. Reject so the user removes
      // the memberships explicitly (cheaper than implicit deletion).
      if (
        req.body.assetRole === 'PROTECTIVE' &&
        existing.assetRole !== 'PROTECTIVE' &&
        existing._count.clusterMemberships > 0
      ) {
        return reply.code(400).send({
          error: 'Cannot reclassify to PROTECTIVE while asset is a member of one or more clusters. Remove cluster memberships first.',
        });
      }

      const data: Prisma.AssetUpdateInput = {};
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.assetType !== undefined) data.assetType = req.body.assetType;
      if (req.body.category !== undefined) data.category = req.body.category;
      if (req.body.description !== undefined) data.description = req.body.description;
      if (req.body.criticality !== undefined) data.criticality = req.body.criticality;
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.assetRole !== undefined) data.assetRole = req.body.assetRole;
      if (req.body.operationalStatus !== undefined) data.operationalStatus = req.body.operationalStatus;
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

      const operationalStatusChanged =
        req.body.operationalStatus !== undefined &&
        req.body.operationalStatus !== existing.operationalStatus;

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.asset.update({
          where: { id },
          data,
          include: { _count: { select: { children: true } } },
        });

        if (operationalStatusChanged) {
          await propagateAssetRisk(tx, tenantId, id, {
            from: existing.operationalStatus,
            to: u.operationalStatus,
          });
        }

        return u;
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

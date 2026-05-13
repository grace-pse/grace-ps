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
  assetRelationshipUpdateSchema,
  assetRelationshipSchema,
  assetGraphResponseSchema,
  protectiveCoverageResponseSchema,
  assetTreeResponseSchema,
  assetTreeQuerySchema,
  assetCustomFieldSchemaResponse,
} from './schema.js';
import { cloneAssetTree, copyInternalRelationships } from './clone.js';
import { propagateAssetRisk } from '../../lib/propagate-asset-risk.js';
import { getProtectiveCoverageForAsset } from '../../lib/protective-coverage.js';
import {
  slugify,
  nextAvailableSegment,
  recomputeSubtreePath,
  assignPathsForSubtree,
  buildPathPredicate,
  InvalidPathPattern,
} from './path.js';

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
    path: a.path,
    pathSegment: a.pathSegment,
    layoutOrder: a.layoutOrder,
    layoutOrientation: a.layoutOrientation,
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default async function assetRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── CUSTOM FIELD SCHEMA (static — register before /:id) ──
  // Returns the merged custom-field schema for assets across all enabled
  // packages. The asset form renders one collapsible per package and
  // persists values into Asset.metadata.customFields[packageSlug][fieldKey].
  // Filter to appliesTo='asset' here so the client renders nothing extra
  // when no asset-applicable fields are defined anywhere.
  router.get(
    '/custom-field-schema',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['assets'],
        summary: 'Per-package custom-field schema for the asset form',
        security: [{ bearerAuth: [] }],
        response: { 200: assetCustomFieldSchemaResponse },
      },
    },
    async () => {
      const packages = await prisma.templatePackage.findMany({
        where: { enabled: true },
        select: { slug: true, name: true, customFieldSchema: true },
        orderBy: [{ name: 'asc' }],
      });

      type RawDef = {
        key?: unknown; label?: unknown; type?: unknown; appliesTo?: unknown;
        options?: unknown; required?: unknown; helpText?: unknown; sortOrder?: unknown;
      };
      const allowedTypes = new Set(['text', 'number', 'select', 'date', 'boolean']);

      const out = packages
        .map((p) => {
          // Legacy packages may have null / object / {}; only arrays carry
          // the structured definitions. Anything else collapses to no fields.
          const arr = Array.isArray(p.customFieldSchema) ? (p.customFieldSchema as RawDef[]) : [];
          const fields = arr
            .filter((f) =>
              typeof f === 'object' && f !== null &&
              typeof f.key === 'string' && typeof f.label === 'string' &&
              typeof f.type === 'string' && allowedTypes.has(f.type) &&
              f.appliesTo === 'asset',
            )
            .map((f, i) => ({
              key: f.key as string,
              label: f.label as string,
              type: f.type as 'text' | 'number' | 'select' | 'date' | 'boolean',
              options: Array.isArray(f.options) ? (f.options as unknown[]).filter((o): o is string => typeof o === 'string') : undefined,
              required: typeof f.required === 'boolean' ? f.required : undefined,
              helpText: typeof f.helpText === 'string' ? f.helpText : undefined,
              sortOrder: typeof f.sortOrder === 'number' ? f.sortOrder : i,
            }))
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          return { slug: p.slug, name: p.name, fields };
        })
        .filter((p) => p.fields.length > 0);

      return { packages: out };
    },
  );

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
            layoutOrder: true, layoutOrientation: true,
          },
          orderBy: [{ parentId: 'asc' }, { layoutOrder: 'asc' }, { name: 'asc' }],
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

  // ── TREE (catalog tree view — register before /:id)
  router.get(
    '/tree',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['assets'],
        summary: 'Flat list of assets shaped for the tree-view page',
        security: [{ bearerAuth: [] }],
        querystring: assetTreeQuerySchema,
        response: { 200: assetTreeResponseSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const { path: pathPattern } = req.query;

      const [assets, relationships] = await Promise.all([
        prisma.asset.findMany({
          where: { tenantId },
          select: {
            id: true, name: true, assetType: true, category: true,
            criticality: true, status: true, assetRole: true,
            operationalStatus: true, parentId: true, tags: true,
            path: true, pathSegment: true,
          },
          orderBy: [{ name: 'asc' }],
        }),
        prisma.assetRelationship.findMany({
          where: { tenantId },
          select: {
            sourceAssetId: true, targetAssetId: true,
            relationshipType: true, direction: true,
          },
        }),
      ]);

      // Build parent → children for childCount + implicit-coverage subtree
      // walks (PROTECTIVE/DUAL assets anywhere inside an ancestor's subtree
      // count as implicit coverage for that ancestor).
      const childrenById = new Map<string, string[]>();
      const byId = new Map<string, (typeof assets)[number]>();
      for (const a of assets) {
        byId.set(a.id, a);
        if (a.parentId) {
          const arr = childrenById.get(a.parentId);
          if (arr) arr.push(a.id);
          else childrenById.set(a.parentId, [a.id]);
        }
      }

      // Explicit coverage: any asset that's the target of a PROTECTS/MONITORS
      // edge (or the source of a BIDIRECTIONAL one).
      const explicitlyCovered = new Set<string>();
      const inDegree = new Map<string, number>();
      const outDegree = new Map<string, number>();
      for (const r of relationships) {
        outDegree.set(r.sourceAssetId, (outDegree.get(r.sourceAssetId) ?? 0) + 1);
        inDegree.set(r.targetAssetId, (inDegree.get(r.targetAssetId) ?? 0) + 1);
        const isProtective = r.relationshipType === 'PROTECTS' || r.relationshipType === 'MONITORS';
        if (!isProtective) continue;
        explicitlyCovered.add(r.targetAssetId);
        if (r.direction === 'BIDIRECTIONAL') explicitlyCovered.add(r.sourceAssetId);
      }

      // Implicit coverage: walk every asset's subtree once and check whether
      // any descendant is PROTECTIVE / DUAL. Memoised so deep trees stay
      // O(N).
      const implicitCovered = new Set<string>();
      function hasProtectiveDescendant(id: string): boolean {
        if (implicitCovered.has(id)) return true;
        const kids = childrenById.get(id) ?? [];
        for (const c of kids) {
          const child = byId.get(c);
          if (!child) continue;
          if (child.assetRole === 'PROTECTIVE' || child.assetRole === 'DUAL') {
            implicitCovered.add(id);
            return true;
          }
          if (hasProtectiveDescendant(c)) {
            implicitCovered.add(id);
            return true;
          }
        }
        return false;
      }
      for (const a of assets) hasProtectiveDescendant(a.id);

      // In-process path filter: tree fetch already loads every tenant asset,
      // so an extra DB round-trip would be wasteful.
      let matcher: ((path: string) => boolean) | null = null;
      if (pathPattern && pathPattern.trim()) {
        const trimmed = pathPattern.trim();
        const hasWildcards = trimmed.includes('+') || trimmed.includes('#');
        try {
          if (!hasWildcards) {
            matcher = (p) => p.startsWith(trimmed);
          } else {
            // Reuse the SQL-pattern builder by re-deriving the regex from the
            // pattern. Simpler: inline a JS-equivalent regex.
            // Validate via buildPathPredicate (throws on bad patterns).
            buildPathPredicate(trimmed);
            const segs = trimmed.split('/');
            const parts: string[] = [];
            for (let i = 0; i < segs.length; i++) {
              const s = segs[i] ?? '';
              if (s === '+') parts.push('[^/]+');
              else if (s === '#') parts.push('(.*)?');
              else parts.push(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
              if (i < segs.length - 1) parts.push('/');
            }
            let regexSrc = parts.join('');
            if (trimmed.includes('#')) regexSrc = regexSrc.replace(/\/\(\.\*\)\?$/, '(/.*)?');
            const re = new RegExp(`^${regexSrc}$`);
            matcher = (p) => re.test(p);
          }
        } catch (e) {
          if (e instanceof InvalidPathPattern) {
            return reply.code(400).send({ error: e.message });
          }
          throw e;
        }
      }

      const items = assets
        .filter((a) => (matcher ? matcher(a.path) : true))
        .map((a) => {
          let coverageStatus: 'covered' | 'uncovered' | 'na';
          if (a.assetRole === 'PROTECTIVE') {
            coverageStatus = 'na';
          } else if (explicitlyCovered.has(a.id) || implicitCovered.has(a.id)) {
            coverageStatus = 'covered';
          } else {
            coverageStatus = 'uncovered';
          }
          return {
            id: a.id,
            name: a.name,
            assetType: a.assetType,
            category: a.category,
            criticality: a.criticality,
            status: a.status,
            assetRole: a.assetRole,
            operationalStatus: a.operationalStatus,
            parentId: a.parentId,
            tags: a.tags,
            childCount: childrenById.get(a.id)?.length ?? 0,
            path: a.path,
            pathSegment: a.pathSegment,
            coverageStatus,
            inDegree: inDegree.get(a.id) ?? 0,
            outDegree: outDegree.get(a.id) ?? 0,
          };
        });

      return { items };
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

  // ── RELATIONSHIPS: UPDATE
  router.patch(
    '/relationships/:id',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['assets'],
        summary: 'Update an asset relationship edge',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: assetRelationshipUpdateSchema,
        response: { 200: assetRelationshipSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.assetRelationship.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'relationship not found' });

      const { relationshipType, direction, impactPropagation, description } = req.body;
      const data: Prisma.AssetRelationshipUpdateInput = {};
      if (relationshipType !== undefined) data.relationshipType = relationshipType;
      if (direction !== undefined) data.direction = direction;
      if (impactPropagation !== undefined) data.impactPropagation = impactPropagation;
      if (description !== undefined) data.description = description;

      const rel = await prisma.assetRelationship.update({
        where: { id: req.params.id },
        data,
      });
      return reply.code(200).send({
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
        response: { 200: assetListResponseSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const {
        search, assetType, category, status, assetRole, operationalStatus,
        degradedControlPosture, parentId, path, page, pageSize,
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

      // MQTT-style path filter. Prefix-only patterns use the index-friendly
      // startsWith; wildcards fall back to a raw $queryRaw with the regex
      // predicate (Prisma has no native regex filter for LIKE/POSIX).
      let pathIds: string[] | null = null;
      if (path) {
        const trimmed = path.trim();
        const hasWildcards = trimmed.includes('+') || trimmed.includes('#');
        try {
          if (!hasWildcards) {
            where.path = { startsWith: trimmed };
          } else {
            const predicate = buildPathPredicate(trimmed);
            const rows = await prisma.$queryRaw<{ id: string }[]>`
              SELECT id FROM assets
              WHERE tenant_id = ${tenantId}::uuid AND ${predicate}
            `;
            pathIds = rows.map((r) => r.id);
            if (pathIds.length === 0) {
              return { items: [], total: 0, page, pageSize };
            }
            where.id = { in: pathIds };
          }
        } catch (e) {
          if (e instanceof InvalidPathPattern) {
            return reply.code(400).send({ error: e.message });
          }
          throw e;
        }
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

      const items = await getProtectiveCoverageForAsset(prisma, tenantId, id);
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
        path: asset.path,
        pathSegment: asset.pathSegment,
        sourceTemplateId: asset.sourceTemplateId,
        layoutOrder: asset.layoutOrder,
        layoutOrientation: asset.layoutOrientation,
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

      // Lane-grid: place new sibling at end of parent's lane unless caller
      // sent an explicit order. Float so future inserts can bisect.
      let layoutOrder = data.layoutOrder;
      if (layoutOrder === undefined) {
        const last = await prisma.asset.findFirst({
          where: { tenantId, parentId: data.parentId ?? null },
          orderBy: { layoutOrder: 'desc' },
          select: { layoutOrder: true },
        });
        layoutOrder = (last?.layoutOrder ?? 0) + 1;
      }

      const created = await prisma.$transaction(async (tx) => {
        const parentPath = data.parentId
          ? (await tx.asset.findUnique({
              where: { id: data.parentId },
              select: { path: true },
            }))?.path ?? ''
          : '';
        const segment = await nextAvailableSegment(tx, {
          tenantId,
          parentId: data.parentId ?? null,
          baseSlug: slugify(data.name),
        });
        const path = parentPath ? `${parentPath}/${segment}` : segment;

        return tx.asset.create({
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
            pathSegment: segment,
            path,
            layoutOrder,
            layoutOrientation: data.layoutOrientation ?? 'AUTO',
          },
          include: { _count: { select: { children: true } } },
        });
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
        await assignPathsForSubtree(tx, tenantId, rootId);
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

        // Cycle guard: walk the proposed parent's ancestor chain and refuse
        // if it contains this asset (would create a parent_id cycle, e.g.,
        // dragging the building under one of its own rooms in the graph).
        // Bounded: even a deep topology rarely has more than a dozen
        // ancestors, and we cap the walk defensively.
        let cursor: string | null = req.body.parentId;
        for (let depth = 0; depth < 64 && cursor; depth++) {
          if (cursor === id) {
            return reply.code(400).send({
              error: 'Cycle: the proposed parent is a descendant of this asset.',
            });
          }
          const node: { parentId: string | null } | null = await prisma.asset.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          });
          cursor = node?.parentId ?? null;
        }
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
      if (req.body.layoutOrientation !== undefined) data.layoutOrientation = req.body.layoutOrientation;
      // Lane-grid order: explicit value wins. On reparent without an explicit
      // order, place the dragged node at the end of the new parent's lane so
      // it stays visible.
      if (req.body.layoutOrder !== undefined) {
        data.layoutOrder = req.body.layoutOrder;
      } else if (req.body.parentId !== undefined && req.body.parentId !== existing.parentId) {
        const last = await prisma.asset.findFirst({
          where: { tenantId, parentId: req.body.parentId ?? null },
          orderBy: { layoutOrder: 'desc' },
          select: { layoutOrder: true },
        });
        data.layoutOrder = (last?.layoutOrder ?? 0) + 1;
      }

      const operationalStatusChanged =
        req.body.operationalStatus !== undefined &&
        req.body.operationalStatus !== existing.operationalStatus;

      const nameChanged = req.body.name !== undefined && req.body.name !== existing.name;
      const parentChanged =
        req.body.parentId !== undefined && (req.body.parentId ?? null) !== existing.parentId;
      const pathDirty = nameChanged || parentChanged;

      const updated = await prisma.$transaction(async (tx) => {
        if (pathDirty) {
          const newParentId = req.body.parentId !== undefined ? (req.body.parentId ?? null) : existing.parentId;
          const newName = req.body.name ?? existing.name;
          const segment = await nextAvailableSegment(tx, {
            tenantId,
            parentId: newParentId,
            baseSlug: slugify(newName),
            excludeId: id,
          });
          data.pathSegment = segment;
        }

        const u = await tx.asset.update({
          where: { id },
          data,
          include: { _count: { select: { children: true } } },
        });

        if (pathDirty) {
          await recomputeSubtreePath(tx, id);
          // Re-read so the response carries the freshly-computed `path`.
          const refreshed = await tx.asset.findUniqueOrThrow({
            where: { id },
            include: { _count: { select: { children: true } } },
          });
          if (operationalStatusChanged) {
            await propagateAssetRisk(tx, tenantId, id, {
              from: existing.operationalStatus,
              to: refreshed.operationalStatus,
            });
          }
          return refreshed;
        }

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

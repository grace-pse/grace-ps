import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  clusterCreateSchema,
  clusterUpdateSchema,
  clusterCloneSchema,
  clusterSummarySchema,
  clusterDetailSchema,
  clusterListResponseSchema,
} from './schema.js';
import { cloneAssetTree, copyInternalRelationships } from '../assets/clone.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

type MembershipWithAsset = Prisma.AssetClusterMembershipGetPayload<{
  include: { asset: { select: { id: true; name: true; assetType: true; criticality: true } } };
}>;

type ClusterWithMembers = Prisma.AssetClusterGetPayload<{
  include: {
    memberships: {
      include: { asset: { select: { id: true; name: true; assetType: true; criticality: true } } };
    };
  };
}>;

function deriveCriticality(cluster: ClusterWithMembers): number | null {
  if (cluster.memberships.length === 0) return null;
  const crits = cluster.memberships.map((m) => m.asset.criticality);
  if (cluster.criticalityMode === 'HIGHEST') return Math.max(...crits);
  if (cluster.criticalityMode === 'AVERAGE') {
    return Math.round(crits.reduce((a, b) => a + b, 0) / crits.length);
  }
  return null; // CUSTOM: not derived
}

function toSummary(cluster: ClusterWithMembers) {
  return {
    id: cluster.id,
    name: cluster.name,
    description: cluster.description,
    clusterType: cluster.clusterType,
    criticalityMode: cluster.criticalityMode,
    statusPropagation: cluster.statusPropagation,
    memberCount: cluster.memberships.length,
    derivedCriticality: deriveCriticality(cluster),
    updatedAt: cluster.updatedAt.toISOString(),
  };
}

function serializeMembership(m: MembershipWithAsset) {
  return {
    assetId: m.assetId,
    asset: m.asset,
    roleInCluster: m.roleInCluster,
    isCritical: m.isCritical,
    dependencyWeight: Number(m.dependencyWeight),
  };
}

export default async function clusterRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST ─────────────────────────────────────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['clusters'],
        summary: 'List asset clusters in current org',
        security: [{ bearerAuth: [] }],
        response: { 200: clusterListResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const clusters = await prisma.assetCluster.findMany({
        where: { tenantId },
        include: {
          memberships: {
            include: {
              asset: { select: { id: true, name: true, assetType: true, criticality: true } },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
      });
      return { items: clusters.map(toSummary), total: clusters.length };
    },
  );

  // ── DETAIL ───────────────────────────────────────────────
  router.get(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assets:read')],
      schema: {
        tags: ['clusters'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: clusterDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const cluster = await prisma.assetCluster.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          memberships: {
            include: {
              asset: { select: { id: true, name: true, assetType: true, criticality: true } },
            },
          },
        },
      });
      if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });

      // Pull full asset summaries for the UI
      const assetIds = cluster.memberships.map((m) => m.assetId);
      const fullAssets = assetIds.length
        ? await prisma.asset.findMany({
            where: { id: { in: assetIds }, tenantId },
            include: { _count: { select: { children: true } } },
          })
        : [];

      return {
        ...toSummary(cluster),
        memberships: cluster.memberships.map(serializeMembership),
        assets: fullAssets.map((a) => ({
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
        })),
      };
    },
  );

  // ── CREATE ───────────────────────────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['clusters'],
        summary: 'Create cluster with initial members',
        security: [{ bearerAuth: [] }],
        body: clusterCreateSchema,
        response: { 201: clusterSummarySchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const data = req.body;

      // Validate all members belong to tenant
      if (data.members.length > 0) {
        const memberIds = data.members.map((m) => m.assetId);
        const validCount = await prisma.asset.count({
          where: { id: { in: memberIds }, tenantId },
        });
        if (validCount !== memberIds.length) {
          return reply.code(400).send({ error: 'One or more assets do not belong to your organization' });
        }
      }

      const created = await prisma.assetCluster.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description ?? null,
          clusterType: data.clusterType,
          criticalityMode: data.criticalityMode,
          statusPropagation: data.statusPropagation,
          memberships: {
            create: data.members.map((m) => ({
              assetId: m.assetId,
              roleInCluster: m.roleInCluster ?? null,
              isCritical: m.isCritical,
              dependencyWeight: m.dependencyWeight,
            })),
          },
        },
        include: {
          memberships: {
            include: {
              asset: { select: { id: true, name: true, assetType: true, criticality: true } },
            },
          },
        },
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
        tags: ['clusters'],
        summary: 'Deep-clone a cluster (settings + every member asset + internal relationships)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: clusterCloneSchema,
        response: { 201: clusterSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const { id } = req.params;

      const source = await prisma.assetCluster.findFirst({
        where: { id, tenantId },
        include: { memberships: true },
      });
      if (!source) return reply.code(404).send({ error: 'Cluster not found' });

      const result = await prisma.$transaction(async (tx) => {
        const combinedIdMap = new Map<string, string>();
        const newMemberships: Array<{
          assetId: string;
          roleInCluster: string | null;
          isCritical: boolean;
          dependencyWeight: Prisma.Decimal;
        }> = [];

        for (const m of source.memberships) {
          const { idMap } = await cloneAssetTree(tx, {
            sourceId: m.assetId,
            tenantId,
            createdById: sub,
            newParentId: null,
          });
          const newAssetId = idMap.get(m.assetId)!;
          for (const [oldId, newId] of idMap) combinedIdMap.set(oldId, newId);
          newMemberships.push({
            assetId: newAssetId,
            roleInCluster: m.roleInCluster,
            isCritical: m.isCritical,
            dependencyWeight: m.dependencyWeight,
          });
        }

        await copyInternalRelationships(tx, { tenantId, idMap: combinedIdMap });

        const cloned = await tx.assetCluster.create({
          data: {
            tenantId,
            name: req.body.name ?? `${source.name} (copy)`,
            description: source.description,
            clusterType: source.clusterType,
            criticalityMode: source.criticalityMode,
            statusPropagation: source.statusPropagation,
            memberships: { create: newMemberships },
          },
          include: {
            memberships: {
              include: {
                asset: { select: { id: true, name: true, assetType: true, criticality: true } },
              },
            },
          },
        });

        return cloned;
      });

      return reply.code(201).send(toSummary(result));
    },
  );

  // ── UPDATE (including full member replacement if provided) ─
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('assets:write')],
      schema: {
        tags: ['clusters'],
        summary: 'Update cluster (pass `members` array to replace full membership)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: clusterUpdateSchema,
        response: { 200: clusterSummarySchema, 404: errorSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const { id } = req.params;

      const existing = await prisma.assetCluster.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.code(404).send({ error: 'Cluster not found' });

      if (req.body.members) {
        const memberIds = req.body.members.map((m) => m.assetId);
        if (memberIds.length > 0) {
          const validCount = await prisma.asset.count({
            where: { id: { in: memberIds }, tenantId },
          });
          if (validCount !== memberIds.length) {
            return reply.code(400).send({ error: 'One or more assets do not belong to your organization' });
          }
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const data: Prisma.AssetClusterUpdateInput = {};
        if (req.body.name !== undefined) data.name = req.body.name;
        if (req.body.description !== undefined) data.description = req.body.description;
        if (req.body.clusterType !== undefined) data.clusterType = req.body.clusterType;
        if (req.body.criticalityMode !== undefined) data.criticalityMode = req.body.criticalityMode;
        if (req.body.statusPropagation !== undefined) data.statusPropagation = req.body.statusPropagation;

        await tx.assetCluster.update({ where: { id }, data });

        if (req.body.members) {
          await tx.assetClusterMembership.deleteMany({ where: { clusterId: id } });
          if (req.body.members.length > 0) {
            await tx.assetClusterMembership.createMany({
              data: req.body.members.map((m) => ({
                clusterId: id,
                assetId: m.assetId,
                roleInCluster: m.roleInCluster ?? null,
                isCritical: m.isCritical,
                dependencyWeight: m.dependencyWeight,
              })),
            });
          }
        }

        return tx.assetCluster.findUniqueOrThrow({
          where: { id },
          include: {
            memberships: {
              include: {
                asset: { select: { id: true, name: true, assetType: true, criticality: true } },
              },
            },
          },
        });
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
        tags: ['clusters'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.assetCluster.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Cluster not found' });

      await prisma.assetCluster.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    },
  );
}

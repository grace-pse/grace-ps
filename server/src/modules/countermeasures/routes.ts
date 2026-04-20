import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  countermeasureCreateSchema,
  countermeasureUpdateSchema,
  countermeasureSummarySchema,
  countermeasureDetailSchema,
  countermeasureListResponseSchema,
  countermeasureListQuerySchema,
} from './schema.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

type CountermeasureWithRelations = Prisma.CountermeasureGetPayload<{
  include: {
    assignedToAsset: { select: { id: true; name: true } };
    assignedToThreat: {
      select: {
        id: true;
        adversaryType: true;
        actionType: true;
        targetAsset: { select: { name: true } };
      };
    };
  };
}>;

function toSummary(cm: CountermeasureWithRelations) {
  return {
    id: cm.id,
    name: cm.name,
    shapeCategory: cm.shapeCategory,
    ppsFunctions: cm.ppsFunctions,
    domain: cm.domain,
    implementationStatus: cm.implementationStatus,
    effectivenessRating: cm.effectivenessRating,
    tearStrategy: cm.tearStrategy,
    costEstimate: cm.costEstimate ? Number(cm.costEstimate) : null,
    annualCost: cm.annualCost ? Number(cm.annualCost) : null,
    assignedToAssetId: cm.assignedToAssetId,
    assignedToThreatId: cm.assignedToThreatId,
    assignedToAssetName: cm.assignedToAsset?.name ?? null,
    assignedToThreatTitle: cm.assignedToThreat
      ? `${cm.assignedToThreat.adversaryType} · ${cm.assignedToThreat.actionType}${
          cm.assignedToThreat.targetAsset ? ` → ${cm.assignedToThreat.targetAsset.name}` : ''
        }`
      : null,
    updatedAt: cm.updatedAt.toISOString(),
  };
}

function toDetail(cm: CountermeasureWithRelations) {
  return {
    ...toSummary(cm),
    description: cm.description,
    alarpJustification: cm.alarpJustification,
    createdAt: cm.createdAt.toISOString(),
  };
}

const include = {
  assignedToAsset: { select: { id: true, name: true } },
  assignedToThreat: {
    select: {
      id: true,
      adversaryType: true,
      actionType: true,
      targetAsset: { select: { name: true } },
    },
  },
} satisfies Prisma.CountermeasureInclude;

export default async function countermeasureRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST ─────────────────────────────────────────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('countermeasures:read')],
      schema: {
        tags: ['countermeasures'],
        summary: 'List countermeasures',
        security: [{ bearerAuth: [] }],
        querystring: countermeasureListQuerySchema,
        response: { 200: countermeasureListResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const q = req.query;
      const where: Prisma.CountermeasureWhereInput = { tenantId };
      if (q.shapeCategory) where.shapeCategory = q.shapeCategory;
      if (q.ppsFunction) where.ppsFunctions = { has: q.ppsFunction };
      if (q.domain) where.domain = q.domain;
      if (q.implementationStatus) where.implementationStatus = q.implementationStatus;
      if (q.assignedToAssetId) where.assignedToAssetId = q.assignedToAssetId;
      if (q.assignedToThreatId) where.assignedToThreatId = q.assignedToThreatId;
      if (q.q) {
        where.OR = [
          { name: { contains: q.q, mode: 'insensitive' } },
          { description: { contains: q.q, mode: 'insensitive' } },
        ];
      }
      const items = await prisma.countermeasure.findMany({
        where,
        include,
        orderBy: [{ updatedAt: 'desc' }],
      });
      return { items: items.map(toSummary), total: items.length };
    },
  );

  // ── DETAIL ───────────────────────────────────────────────
  router.get(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('countermeasures:read')],
      schema: {
        tags: ['countermeasures'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: countermeasureDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const cm = await prisma.countermeasure.findFirst({
        where: { id: req.params.id, tenantId },
        include,
      });
      if (!cm) return reply.code(404).send({ error: 'Countermeasure not found' });
      return toDetail(cm);
    },
  );

  // ── CREATE ───────────────────────────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('countermeasures:write')],
      schema: {
        tags: ['countermeasures'],
        summary: 'Create countermeasure',
        security: [{ bearerAuth: [] }],
        body: countermeasureCreateSchema,
        response: { 201: countermeasureDetailSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const data = req.body;

      if (data.assignedToAssetId) {
        const hit = await prisma.asset.count({
          where: { id: data.assignedToAssetId, tenantId },
        });
        if (!hit) return reply.code(400).send({ error: 'Asset does not belong to your organization' });
      }
      if (data.assignedToThreatId) {
        const hit = await prisma.threat.count({
          where: { id: data.assignedToThreatId, assessment: { tenantId } },
        });
        if (!hit) return reply.code(400).send({ error: 'Threat does not belong to your organization' });
      }

      const created = await prisma.countermeasure.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description ?? null,
          shapeCategory: data.shapeCategory,
          ppsFunctions: data.ppsFunctions,
          domain: data.domain,
          implementationStatus: data.implementationStatus,
          effectivenessRating: data.effectivenessRating ?? null,
          tearStrategy: data.tearStrategy ?? null,
          costEstimate: data.costEstimate ?? null,
          annualCost: data.annualCost ?? null,
          assignedToAssetId: data.assignedToAssetId ?? null,
          assignedToThreatId: data.assignedToThreatId ?? null,
          alarpJustification: data.alarpJustification ?? null,
        },
        include,
      });
      return reply.code(201).send(toDetail(created));
    },
  );

  // ── UPDATE ───────────────────────────────────────────────
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('countermeasures:write')],
      schema: {
        tags: ['countermeasures'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: countermeasureUpdateSchema,
        response: { 200: countermeasureDetailSchema, 404: errorSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const { id } = req.params;
      const existing = await prisma.countermeasure.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.code(404).send({ error: 'Countermeasure not found' });

      const body = req.body;
      if (body.assignedToAssetId) {
        const hit = await prisma.asset.count({
          where: { id: body.assignedToAssetId, tenantId },
        });
        if (!hit) return reply.code(400).send({ error: 'Asset does not belong to your organization' });
      }
      if (body.assignedToThreatId) {
        const hit = await prisma.threat.count({
          where: { id: body.assignedToThreatId, assessment: { tenantId } },
        });
        if (!hit) return reply.code(400).send({ error: 'Threat does not belong to your organization' });
      }

      const data: Prisma.CountermeasureUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.shapeCategory !== undefined) data.shapeCategory = body.shapeCategory;
      if (body.ppsFunctions !== undefined) data.ppsFunctions = body.ppsFunctions;
      if (body.domain !== undefined) data.domain = body.domain;
      if (body.implementationStatus !== undefined) data.implementationStatus = body.implementationStatus;
      if (body.effectivenessRating !== undefined) data.effectivenessRating = body.effectivenessRating;
      if (body.tearStrategy !== undefined) data.tearStrategy = body.tearStrategy;
      if (body.costEstimate !== undefined) data.costEstimate = body.costEstimate;
      if (body.annualCost !== undefined) data.annualCost = body.annualCost;
      if (body.alarpJustification !== undefined) data.alarpJustification = body.alarpJustification;
      if (body.assignedToAssetId !== undefined) {
        data.assignedToAsset = body.assignedToAssetId
          ? { connect: { id: body.assignedToAssetId } }
          : { disconnect: true };
      }
      if (body.assignedToThreatId !== undefined) {
        data.assignedToThreat = body.assignedToThreatId
          ? { connect: { id: body.assignedToThreatId } }
          : { disconnect: true };
      }

      const updated = await prisma.countermeasure.update({
        where: { id },
        data,
        include,
      });
      return toDetail(updated);
    },
  );

  // ── DELETE ───────────────────────────────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('countermeasures:write')],
      schema: {
        tags: ['countermeasures'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.countermeasure.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Countermeasure not found' });
      await prisma.countermeasure.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    },
  );
}

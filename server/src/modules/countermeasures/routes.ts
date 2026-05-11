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
  effectivenessUpdateSchema,
  statusTransitionSchema,
} from './schema.js';
import {
  vulnerabilityRatingToNumeric,
  computeGapDelta,
  gapSeverityFromIrv,
} from './scoring.js';

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

export function toSummary(cm: CountermeasureWithRelations) {
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
    isExisting: cm.isExisting,
    effectivenessScore: cm.effectivenessScore,
    surveyRatingAtCreation: cm.surveyRatingAtCreation,
    surveyRatingNumeric: cm.surveyRatingNumeric,
    gapDelta: cm.gapDelta,
    implementationHorizon: cm.implementationHorizon,
    dueDate: cm.dueDate ? cm.dueDate.toISOString() : null,
    ownerUserId: cm.ownerUserId,
    updatedAt: cm.updatedAt.toISOString(),
  };
}

export function toDetail(cm: CountermeasureWithRelations) {
  return {
    ...toSummary(cm),
    description: cm.description,
    alarpJustification: cm.alarpJustification,
    effectivenessNotes: cm.effectivenessNotes,
    reviewDate: cm.reviewDate ? cm.reviewDate.toISOString() : null,
    implementationDate: cm.implementationDate ? cm.implementationDate.toISOString() : null,
    verificationSurveyId: cm.verificationSurveyId,
    alarpAcceptedBy: cm.alarpAcceptedBy,
    alarpAcceptedAt: cm.alarpAcceptedAt ? cm.alarpAcceptedAt.toISOString() : null,
    createdAt: cm.createdAt.toISOString(),
    sourceTemplateId: cm.sourceTemplateId,
  };
}

export const countermeasureInclude = {
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

const include = countermeasureInclude;

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
      if (q.isExisting !== undefined) where.isExisting = q.isExisting;
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

      const effectivenessScore = data.effectivenessRating
        ? vulnerabilityRatingToNumeric(data.effectivenessRating)
        : null;
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
          effectivenessScore,
          tearStrategy: data.tearStrategy ?? null,
          costEstimate: data.costEstimate ?? null,
          annualCost: data.annualCost ?? null,
          assignedToAssetId: data.assignedToAssetId ?? null,
          assignedToThreatId: data.assignedToThreatId ?? null,
          alarpJustification: data.alarpJustification ?? null,
          sourceTemplateId: data.sourceTemplateId ?? null,
          isExisting: data.isExisting ?? false,
          implementationHorizon: data.implementationHorizon ?? null,
          ownerUserId: data.ownerUserId ?? null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
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
      if (body.effectivenessRating !== undefined) {
        data.effectivenessRating = body.effectivenessRating;
        data.effectivenessScore = body.effectivenessRating
          ? vulnerabilityRatingToNumeric(body.effectivenessRating)
          : null;
      }
      if (body.tearStrategy !== undefined) data.tearStrategy = body.tearStrategy;
      if (body.costEstimate !== undefined) data.costEstimate = body.costEstimate;
      if (body.annualCost !== undefined) data.annualCost = body.annualCost;
      if (body.alarpJustification !== undefined) data.alarpJustification = body.alarpJustification;
      if (body.isExisting !== undefined) data.isExisting = body.isExisting;
      if (body.implementationHorizon !== undefined) data.implementationHorizon = body.implementationHorizon;
      if (body.ownerUserId !== undefined) {
        data.owner = body.ownerUserId
          ? { connect: { id: body.ownerUserId } }
          : { disconnect: true };
      }
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.reviewDate !== undefined) data.reviewDate = body.reviewDate ? new Date(body.reviewDate) : null;
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

  // ── EFFECTIVENESS RATING (Step 6 bridge) ─────────────────
  // Sets effectivenessRating + effectivenessScore, recomputes gapDelta
  // against surveyRatingNumeric, and auto-opens a CountermeasureGap
  // record when gapDelta < 0 (INEFFECTIVE control vs. survey baseline).
  router.put(
    '/:id/effectiveness',
    {
      onRequest: [app.authenticate, requirePermission('countermeasures:write')],
      schema: {
        tags: ['countermeasures'],
        summary: 'Rate effectiveness of an existing countermeasure (Step 6)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: effectivenessUpdateSchema,
        response: { 200: countermeasureDetailSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const existing = await prisma.countermeasure.findFirst({
        where: { id: req.params.id, tenantId },
        select: {
          id: true, surveyRatingNumeric: true, assignedToThreatId: true,
        },
      });
      if (!existing) return reply.code(404).send({ error: 'Countermeasure not found' });

      const newScore = vulnerabilityRatingToNumeric(req.body.effectivenessRating);
      const gapDelta =
        existing.surveyRatingNumeric != null
          ? computeGapDelta(newScore, existing.surveyRatingNumeric)
          : null;

      const updated = await prisma.countermeasure.update({
        where: { id: existing.id },
        data: {
          effectivenessRating: req.body.effectivenessRating,
          effectivenessScore: newScore,
          effectivenessNotes: req.body.effectivenessNotes ?? null,
          gapDelta,
        },
        include,
      });

      // Auto-open an INEFFECTIVE gap when the rated effectiveness falls
      // below the survey baseline. A pre-existing open INEFFECTIVE gap
      // for the same CM is reused rather than duplicated.
      if (gapDelta != null && gapDelta < 0 && existing.assignedToThreatId) {
        const threat = await prisma.threat.findUnique({
          where: { id: existing.assignedToThreatId },
          select: { assessmentId: true, irv: true },
        });
        if (threat) {
          const already = await prisma.countermeasureGap.findFirst({
            where: {
              countermeasureId: existing.id,
              threatId: existing.assignedToThreatId,
              gapType: 'INEFFECTIVE',
              isOpen: true,
            },
            select: { id: true },
          });
          if (!already) {
            await prisma.countermeasureGap.create({
              data: {
                tenantId,
                assessmentId: threat.assessmentId,
                threatId: existing.assignedToThreatId,
                countermeasureId: existing.id,
                gapType: 'INEFFECTIVE',
                gapSeverity: gapSeverityFromIrv(threat.irv, gapDelta),
                description: `Effectiveness (${newScore}) below survey baseline (${existing.surveyRatingNumeric}). Delta ${gapDelta}.`,
                createdById: sub,
              },
            });
          }
        }
      }

      return toDetail(updated);
    },
  );

  // ── STATUS TRANSITION (lifecycle audit) ──────────────────
  // Records every implementation_status change in countermeasure_implementations
  // for the NIS2 Art. 21 audit trail.
  router.patch(
    '/:id/status',
    {
      onRequest: [app.authenticate, requirePermission('countermeasures:write')],
      schema: {
        tags: ['countermeasures'],
        summary: 'Transition countermeasure implementation status (audited)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: statusTransitionSchema,
        response: { 200: countermeasureDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const existing = await prisma.countermeasure.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true, implementationStatus: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Countermeasure not found' });

      const updated = await prisma.$transaction(async (tx) => {
        const cm = await tx.countermeasure.update({
          where: { id: existing.id },
          data: {
            implementationStatus: req.body.toStatus,
            implementationDate: req.body.toStatus === 'IMPLEMENTED' ? new Date() : undefined,
          },
          include,
        });
        await tx.countermeasureImplementation.create({
          data: {
            countermeasureId: existing.id,
            fromStatus: existing.implementationStatus,
            toStatus: req.body.toStatus,
            changedById: sub,
            notes: req.body.notes ?? null,
            evidenceUrl: req.body.evidenceUrl ?? null,
          },
        });
        return cm;
      });

      return toDetail(updated);
    },
  );
}

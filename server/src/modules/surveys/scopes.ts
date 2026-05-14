// ClusterSurveyScope routes — the per-cluster, reusable, versioned survey
// configuration. Authoring flow: create DRAFT → auto-compose to seed items
// from the cluster's AAA → operator curates (add/remove/edit weight) →
// approve. APPROVED scopes are immutable; editing one spawns a new DRAFT
// pointing back via supersedesId. Existing SurveyResponse rows keep their
// pin to the version they were authored against.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  clusterSurveyScopeCreateSchema,
  clusterSurveyScopeUpdateSchema,
  clusterSurveyScopeSummarySchema,
  clusterSurveyScopeDetailSchema,
  clusterSurveyScopeListResponseSchema,
  scopeItemAddSchema,
  scopeItemUpdateSchema,
  scopeStatusEnum,
} from './scopes-schema.js';
import { composeScopeItems, composedItemToCreate, type EvidenceType } from './compose.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

type ScopeRow = Prisma.ClusterSurveyScopeGetPayload<{
  include: {
    cluster: { select: { name: true } };
    createdBy: { select: { firstName: true; lastName: true } };
    approvedBy: { select: { firstName: true; lastName: true } };
    _count: { select: { items: true } };
  };
}>;

function fullName(u: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!u) return null;
  return `${u.firstName} ${u.lastName}`.trim() || null;
}

function summary(s: ScopeRow) {
  return {
    id: s.id,
    clusterId: s.clusterId,
    clusterName: s.cluster?.name ?? null,
    name: s.name,
    description: s.description,
    evidenceTypes: s.evidenceTypes,
    aggregationMode: s.aggregationMode,
    status: s.status,
    version: s.version,
    supersedesId: s.supersedesId,
    createdById: s.createdById,
    createdByName: fullName(s.createdBy),
    approvedById: s.approvedById,
    approvedByName: fullName(s.approvedBy),
    approvedAt: s.approvedAt?.toISOString() ?? null,
    itemCount: s._count.items,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

const summaryInclude = {
  cluster: { select: { name: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  approvedBy: { select: { firstName: true, lastName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.ClusterSurveyScopeInclude;

type ItemRow = Prisma.ClusterSurveyScopeItemGetPayload<{
  include: {
    question: { select: { prompt: true; type: true; evidenceType: true; defaultWeight: true } };
    sourceAsset: { select: { name: true } };
    sourceThreat: { select: { adversaryType: true; actionType: true; targetAsset: { select: { name: true } } } };
    sourceCountermeasure: { select: { name: true } };
    sourceCountermeasureTemplate: { select: { name: true } };
  };
}>;

function describeSource(it: ItemRow): string {
  switch (it.sourceType) {
    case 'ASSET':
      return it.sourceAsset?.name ? `Asset: ${it.sourceAsset.name}` : 'Asset (deleted)';
    case 'THREAT':
      if (!it.sourceThreat) return 'Threat (deleted)';
      const target = it.sourceThreat.targetAsset?.name ?? 'asset';
      return `Threat: ${it.sourceThreat.adversaryType}/${it.sourceThreat.actionType} → ${target}`;
    case 'COUNTERMEASURE':
      return it.sourceCountermeasure?.name ? `CM: ${it.sourceCountermeasure.name}` : 'CM (deleted)';
    case 'COUNTERMEASURE_GROUP':
      return it.sourceCountermeasureTemplate?.name
        ? `CM group: ${it.sourceCountermeasureTemplate.name}`
        : 'CM group (deleted)';
    case 'MANUAL':
    default:
      return 'Manual';
  }
}

function serializeItem(it: ItemRow) {
  const effectiveWeight = it.weightOverride ?? it.question.defaultWeight;
  return {
    id: it.id,
    questionId: it.questionId,
    prompt: it.question.prompt,
    type: it.question.type,
    evidenceType: it.question.evidenceType,
    defaultWeight: it.question.defaultWeight,
    effectiveWeight,
    sourceType: it.sourceType,
    sourceAssetId: it.sourceAssetId,
    sourceThreatId: it.sourceThreatId,
    sourceCountermeasureId: it.sourceCountermeasureId,
    sourceCountermeasureTemplateId: it.sourceCountermeasureTemplateId,
    sourceLabel: describeSource(it),
    weightOverride: it.weightOverride,
    sortOrder: it.sortOrder,
  };
}

const itemInclude = {
  question: { select: { prompt: true, type: true, evidenceType: true, defaultWeight: true } },
  sourceAsset: { select: { name: true } },
  sourceThreat: {
    select: {
      adversaryType: true,
      actionType: true,
      targetAsset: { select: { name: true } },
    },
  },
  sourceCountermeasure: { select: { name: true } },
  sourceCountermeasureTemplate: { select: { name: true } },
} satisfies Prisma.ClusterSurveyScopeItemInclude;

async function loadDetail(id: string, tenantId: string) {
  const s = await prisma.clusterSurveyScope.findFirst({
    where: { id, tenantId },
    include: summaryInclude,
  });
  if (!s) return null;
  const items = await prisma.clusterSurveyScopeItem.findMany({
    where: { scopeId: id },
    include: itemInclude,
    orderBy: [{ sortOrder: 'asc' }, { addedAt: 'asc' }],
  });
  return { ...summary(s), items: items.map(serializeItem) };
}

export default async function clusterSurveyScopeRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST (per cluster, optional status filter) ────────────
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['surveys'],
        summary: 'List cluster survey scopes',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          clusterId: uuid.optional(),
          status: scopeStatusEnum.optional(),
        }),
        response: { 200: clusterSurveyScopeListResponseSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const where: Prisma.ClusterSurveyScopeWhereInput = {
        tenantId,
        ...(req.query.clusterId ? { clusterId: req.query.clusterId } : {}),
        ...(req.query.status ? { status: req.query.status } : {}),
      };
      const items = await prisma.clusterSurveyScope.findMany({
        where,
        include: summaryInclude,
        orderBy: [{ updatedAt: 'desc' }],
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
        response: { 200: clusterSurveyScopeDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const detail = await loadDetail(req.params.id, tenantId);
      if (!detail) return reply.code(404).send({ error: 'Scope not found' });
      return detail;
    },
  );

  // ── CREATE (DRAFT, no items yet) ──────────────────────────
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        summary: 'Create a DRAFT cluster survey scope (items added separately or via auto-compose)',
        security: [{ bearerAuth: [] }],
        body: clusterSurveyScopeCreateSchema,
        response: { 201: clusterSurveyScopeDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub, tenantId } = req.user as JwtPayload;
      const cluster = await prisma.assetCluster.findFirst({
        where: { id: req.body.clusterId, tenantId },
      });
      if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });
      const created = await prisma.clusterSurveyScope.create({
        data: {
          tenantId,
          clusterId: req.body.clusterId,
          name: req.body.name,
          description: req.body.description ?? null,
          evidenceTypes: req.body.evidenceTypes,
          aggregationMode: req.body.aggregationMode,
          status: 'DRAFT',
          createdById: sub,
        },
      });
      const detail = await loadDetail(created.id, tenantId);
      return reply.code(201).send(detail!);
    },
  );

  // ── AUTO-COMPOSE (seed DRAFT scope's items from AAA) ─────
  router.post(
    '/:id/auto-compose',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        summary: 'Replace DRAFT scope items with AAA-derived seed set',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        querystring: z.object({
          mode: z.enum(['replace', 'merge']).default('replace'),
        }),
        response: { 200: clusterSurveyScopeDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub, tenantId } = req.user as JwtPayload;
      const scope = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!scope) return reply.code(404).send({ error: 'Scope not found' });
      if (scope.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT scopes can be auto-composed' });
      }

      const composed = await composeScopeItems({
        tenantId,
        clusterId: scope.clusterId,
        evidenceTypes: scope.evidenceTypes as EvidenceType[],
        aggregationMode: scope.aggregationMode,
      });

      await prisma.$transaction(async (tx) => {
        if (req.query.mode === 'replace') {
          await tx.clusterSurveyScopeItem.deleteMany({ where: { scopeId: scope.id } });
        }
        for (const it of composed) {
          // In merge mode, skip exact dupes (same question + same source FKs).
          if (req.query.mode === 'merge') {
            const dupe = await tx.clusterSurveyScopeItem.findFirst({
              where: {
                scopeId: scope.id,
                questionId: it.questionId,
                sourceType: it.sourceType,
                sourceAssetId: it.sourceAssetId,
                sourceThreatId: it.sourceThreatId,
                sourceCountermeasureId: it.sourceCountermeasureId,
                sourceCountermeasureTemplateId: it.sourceCountermeasureTemplateId,
              },
              select: { id: true },
            });
            if (dupe) continue;
          }
          await tx.clusterSurveyScopeItem.create({
            data: composedItemToCreate(scope.id, sub, it),
          });
        }
      });

      const detail = await loadDetail(scope.id, tenantId);
      return detail!;
    },
  );

  // ── PATCH (DRAFT only — name/description/evidenceTypes/aggregation) ─
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: clusterSurveyScopeUpdateSchema,
        response: { 200: clusterSurveyScopeDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Scope not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT scopes can be edited; revise instead' });
      }
      const b = req.body;
      await prisma.clusterSurveyScope.update({
        where: { id: existing.id },
        data: {
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.evidenceTypes !== undefined ? { evidenceTypes: b.evidenceTypes } : {}),
          ...(b.aggregationMode !== undefined ? { aggregationMode: b.aggregationMode } : {}),
        },
      });
      const detail = await loadDetail(existing.id, tenantId);
      return detail!;
    },
  );

  // ── APPROVE (DRAFT → APPROVED) ────────────────────────────
  router.post(
    '/:id/approve',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        summary: 'Approve a DRAFT scope (becomes immutable; survey runs can target it)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: clusterSurveyScopeDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub, tenantId } = req.user as JwtPayload;
      const existing = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
        include: { _count: { select: { items: true } } },
      });
      if (!existing) return reply.code(404).send({ error: 'Scope not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT scopes can be approved' });
      }
      if (existing._count.items === 0) {
        return reply.code(409).send({ error: 'Scope has no items; nothing to approve' });
      }
      await prisma.clusterSurveyScope.update({
        where: { id: existing.id },
        data: { status: 'APPROVED', approvedById: sub, approvedAt: new Date() },
      });
      // Archive any prior APPROVED scope it supersedes so only one APPROVED
      // version per chain stays active.
      if (existing.supersedesId) {
        await prisma.clusterSurveyScope.update({
          where: { id: existing.supersedesId },
          data: { status: 'ARCHIVED' },
        });
      }
      const detail = await loadDetail(existing.id, tenantId);
      return detail!;
    },
  );

  // ── REVISE (APPROVED → spawn new DRAFT pointing back) ────
  router.post(
    '/:id/revise',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        summary: 'Spawn a new DRAFT scope cloned from an APPROVED one',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 201: clusterSurveyScopeDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub, tenantId } = req.user as JwtPayload;
      const src = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
        include: { items: true },
      });
      if (!src) return reply.code(404).send({ error: 'Scope not found' });
      if (src.status !== 'APPROVED') {
        return reply.code(409).send({ error: 'Only APPROVED scopes can be revised' });
      }

      const created = await prisma.$transaction(async (tx) => {
        const draft = await tx.clusterSurveyScope.create({
          data: {
            tenantId: src.tenantId,
            clusterId: src.clusterId,
            name: src.name,
            description: src.description,
            evidenceTypes: src.evidenceTypes,
            aggregationMode: src.aggregationMode,
            status: 'DRAFT',
            version: src.version + 1,
            supersedesId: src.id,
            createdById: sub,
          },
        });
        for (const it of src.items) {
          await tx.clusterSurveyScopeItem.create({
            data: {
              scopeId: draft.id,
              questionId: it.questionId,
              sourceType: it.sourceType,
              sourceAssetId: it.sourceAssetId,
              sourceThreatId: it.sourceThreatId,
              sourceCountermeasureId: it.sourceCountermeasureId,
              sourceCountermeasureTemplateId: it.sourceCountermeasureTemplateId,
              weightOverride: it.weightOverride,
              sortOrder: it.sortOrder,
              addedById: sub,
            },
          });
        }
        return draft;
      });
      const detail = await loadDetail(created.id, tenantId);
      return reply.code(201).send(detail!);
    },
  );

  // ── ARCHIVE ──────────────────────────────────────────────
  router.post(
    '/:id/archive',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: clusterSurveyScopeSummarySchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Scope not found' });
      if (existing.status === 'ARCHIVED') {
        return reply.code(409).send({ error: 'Already archived' });
      }
      const updated = await prisma.clusterSurveyScope.update({
        where: { id: existing.id },
        data: { status: 'ARCHIVED' },
        include: summaryInclude,
      });
      return summary(updated);
    },
  );

  // ── DELETE (DRAFT only, no responses) ────────────────────
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
        include: { _count: { select: { responses: true } } },
      });
      if (!existing) return reply.code(404).send({ error: 'Scope not found' });
      if (existing.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT scopes can be deleted; archive instead' });
      }
      if (existing._count.responses > 0) {
        return reply.code(409).send({ error: 'Scope has linked responses' });
      }
      await prisma.clusterSurveyScope.delete({ where: { id: existing.id } });
      return reply.code(204).send(null);
    },
  );

  // ────────────────────────────────────────────────────────
  // SCOPE ITEMS — manual add / update weight / remove. DRAFT only.
  // ────────────────────────────────────────────────────────

  router.post(
    '/:id/items',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        summary: 'Add an item (manual or AAA-bound) to a DRAFT scope',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: scopeItemAddSchema,
        response: { 201: clusterSurveyScopeDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub, tenantId } = req.user as JwtPayload;
      const scope = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!scope) return reply.code(404).send({ error: 'Scope not found' });
      if (scope.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT scopes can be edited' });
      }
      const q = await prisma.surveyQuestion.findFirst({
        where: {
          id: req.body.questionId,
          OR: [{ tenantId: null }, { tenantId }],
          isActive: true,
        },
        select: { id: true },
      });
      if (!q) return reply.code(404).send({ error: 'Question not found or inactive' });

      await prisma.clusterSurveyScopeItem.create({
        data: {
          scopeId: scope.id,
          questionId: req.body.questionId,
          sourceType: req.body.sourceType,
          sourceAssetId: req.body.sourceAssetId ?? null,
          sourceThreatId: req.body.sourceThreatId ?? null,
          sourceCountermeasureId: req.body.sourceCountermeasureId ?? null,
          sourceCountermeasureTemplateId: req.body.sourceCountermeasureTemplateId ?? null,
          weightOverride: req.body.weightOverride ?? null,
          sortOrder: req.body.sortOrder,
          addedById: sub,
        },
      });
      const detail = await loadDetail(scope.id, tenantId);
      return reply.code(201).send(detail!);
    },
  );

  router.patch(
    '/:id/items/:itemId',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, itemId: uuid }),
        body: scopeItemUpdateSchema,
        response: { 200: clusterSurveyScopeDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const scope = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!scope) return reply.code(404).send({ error: 'Scope not found' });
      if (scope.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT scopes can be edited' });
      }
      const item = await prisma.clusterSurveyScopeItem.findFirst({
        where: { id: req.params.itemId, scopeId: scope.id },
      });
      if (!item) return reply.code(404).send({ error: 'Item not found' });
      await prisma.clusterSurveyScopeItem.update({
        where: { id: item.id },
        data: {
          ...(req.body.weightOverride !== undefined ? { weightOverride: req.body.weightOverride } : {}),
          ...(req.body.sortOrder !== undefined ? { sortOrder: req.body.sortOrder } : {}),
        },
      });
      const detail = await loadDetail(scope.id, tenantId);
      return detail!;
    },
  );

  router.delete(
    '/:id/items/:itemId',
    {
      onRequest: [app.authenticate, requirePermission('surveys:scope')],
      schema: {
        tags: ['surveys'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, itemId: uuid }),
        response: { 200: clusterSurveyScopeDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const scope = await prisma.clusterSurveyScope.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!scope) return reply.code(404).send({ error: 'Scope not found' });
      if (scope.status !== 'DRAFT') {
        return reply.code(409).send({ error: 'Only DRAFT scopes can be edited' });
      }
      await prisma.clusterSurveyScopeItem.deleteMany({
        where: { id: req.params.itemId, scopeId: scope.id },
      });
      const detail = await loadDetail(scope.id, tenantId);
      return detail!;
    },
  );
}

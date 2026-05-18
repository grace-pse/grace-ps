import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma, RiskPriority } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { captureSnapshot } from './snapshots.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

import type { JwtPayload } from '../../lib/jwt.js';

const riskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'HIGHEST']);

const recommendationSchema = z.object({
  id: uuid,
  assessmentId: uuid,
  ref: z.string(),
  priority: riskPriorityEnum,
  title: z.string(),
  body: z.string(),
  owner: z.string().nullable(),
  horizon: z.string().nullable(),
  cost: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const refSchema = z.string().trim().regex(/^[A-Za-z0-9]{1,8}$/, 'ref must be 1–8 alphanumeric chars');

const recommendationCreateSchema = z.object({
  ref: refSchema.optional(),
  priority: riskPriorityEnum,
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  owner: z.string().trim().max(120).nullable().optional(),
  horizon: z.string().trim().max(40).nullable().optional(),
  cost: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const recommendationUpdateSchema = z.object({
  ref: refSchema.optional(),
  priority: riskPriorityEnum.optional(),
  title: z.string().trim().min(1).max(255).optional(),
  body: z.string().trim().min(1).optional(),
  owner: z.string().trim().max(120).nullable().optional(),
  horizon: z.string().trim().max(40).nullable().optional(),
  cost: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

type RecommendationRow = {
  id: string; assessmentId: string;
  ref: string; priority: RiskPriority; title: string; body: string;
  owner: string | null; horizon: string | null; cost: string | null;
  sortOrder: number; createdAt: Date; updatedAt: Date;
};

function serialize(r: RecommendationRow) {
  return {
    id: r.id,
    assessmentId: r.assessmentId,
    ref: r.ref,
    priority: r.priority as z.infer<typeof riskPriorityEnum>,
    title: r.title,
    body: r.body,
    owner: r.owner,
    horizon: r.horizon,
    cost: r.cost,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function nextRefAndSortOrder(assessmentId: string) {
  const existing = await prisma.recommendation.findMany({
    where: { assessmentId },
    select: { ref: true, sortOrder: true },
  });
  let maxNumericRef = 0;
  for (const e of existing) {
    const m = /^R(\d+)$/i.exec(e.ref);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxNumericRef) maxNumericRef = n;
    }
  }
  const ref = `R${String(maxNumericRef + 1).padStart(2, '0')}`;
  const maxSort = existing.reduce((acc, e) => Math.max(acc, e.sortOrder), -1);
  return { ref, sortOrder: maxSort + 1 };
}

export default async function recommendationRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/assessments/:id/recommendations',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['recommendations'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: z.object({ items: z.array(recommendationSchema) }), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const items = await prisma.recommendation.findMany({
        where: { assessmentId: a.id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return { items: items.map(serialize) };
    },
  );

  router.post(
    '/assessments/:id/recommendations',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['recommendations'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: recommendationCreateSchema,
        response: { 201: recommendationSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const auto = await nextRefAndSortOrder(a.id);
      const ref = req.body.ref ?? auto.ref;
      const sortOrder = req.body.sortOrder ?? auto.sortOrder;

      try {
        const created = await prisma.recommendation.create({
          data: {
            assessmentId: a.id,
            ref,
            priority: req.body.priority,
            title: req.body.title,
            body: req.body.body,
            owner: req.body.owner ?? null,
            horizon: req.body.horizon ?? null,
            cost: req.body.cost ?? null,
            sortOrder,
          },
        });
        await captureSnapshot({
          assessmentId: a.id,
          capturedById: sub,
          reason: 'RECOMMENDATION_ADDED',
          note: `${created.ref} — ${created.title}`,
        });
        return reply.code(201).send(serialize(created));
      } catch (err) {
        if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
          return reply.code(409).send({ error: `Recommendation ref "${ref}" already exists` });
        }
        throw err;
      }
    },
  );

  router.patch(
    '/recommendations/:recId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['recommendations'],
        security: [{ bearerAuth: [] }],
        params: z.object({ recId: uuid }),
        body: recommendationUpdateSchema,
        response: { 200: recommendationSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.recommendation.findFirst({
        where: { id: req.params.recId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Recommendation not found' });

      const data: Prisma.RecommendationUpdateInput = {};
      if (req.body.ref !== undefined) data.ref = req.body.ref;
      if (req.body.priority !== undefined) data.priority = req.body.priority;
      if (req.body.title !== undefined) data.title = req.body.title;
      if (req.body.body !== undefined) data.body = req.body.body;
      if (req.body.owner !== undefined) data.owner = req.body.owner;
      if (req.body.horizon !== undefined) data.horizon = req.body.horizon;
      if (req.body.cost !== undefined) data.cost = req.body.cost;
      if (req.body.sortOrder !== undefined) data.sortOrder = req.body.sortOrder;

      try {
        const updated = await prisma.recommendation.update({
          where: { id: req.params.recId }, data,
        });
        return serialize(updated);
      } catch (err) {
        if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
          return reply.code(409).send({ error: `Recommendation ref "${req.body.ref}" already exists` });
        }
        throw err;
      }
    },
  );

  router.delete(
    '/recommendations/:recId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['recommendations'],
        security: [{ bearerAuth: [] }],
        params: z.object({ recId: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.recommendation.findFirst({
        where: { id: req.params.recId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Recommendation not found' });
      await prisma.recommendation.delete({ where: { id: req.params.recId } });
      return reply.code(204).send();
    },
  );
}
